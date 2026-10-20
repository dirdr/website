use ndarray::{Array1, Array2};
use nn_lib::{
    activation::Activation,
    cost::CostFunction,
    layer::{ActivationLayer, DenseLayer},
    optimizer::GradientDescent,
    sequential::{Sequential, SequentialBuilder},
};
use wasm_bindgen::prelude::*;

pub const SIZES: [usize; 4] = [784, 256, 256, 10];
const MAGIC: &[u8; 4] = b"MNP1";

fn builder(layers: Vec<DenseLayer>) -> Sequential {
    let mut builder = SequentialBuilder::new();
    for (index, layer) in layers.into_iter().enumerate() {
        builder = builder
            .push(layer)
            .push(ActivationLayer::from(if index == 2 {
                Activation::Softmax
            } else {
                Activation::ReLU
            }));
    }
    builder
        .compile(GradientDescent::new(0.04), CostFunction::CrossEntropy)
        .expect("fixed MLP has a softmax output")
}

pub fn export_model(network: &Sequential) -> Vec<u8> {
    let mut bytes = MAGIC.to_vec();
    for parameters in network.dense_parameters() {
        for parameter in parameters {
            for value in parameter.iter() {
                bytes.extend_from_slice(&value.to_le_bytes());
            }
        }
    }
    bytes
}

pub fn load_model(bytes: &[u8]) -> Result<Sequential, String> {
    let count: usize = SIZES.windows(2).map(|s| s[0] * s[1] + s[1]).sum();
    if bytes.len() != 4 + count * 8 || &bytes[..4] != MAGIC {
        return Err("Invalid MNIST model file".into());
    }
    let mut values = Vec::with_capacity(count);
    for chunk in bytes[4..].chunks_exact(8) {
        let value = f64::from_le_bytes(chunk.try_into().unwrap());
        if !value.is_finite() {
            return Err("Non-finite model parameter".into());
        }
        values.push(value);
    }
    let mut offset = 0;
    let mut layers = Vec::new();
    for size in SIZES.windows(2) {
        let length = size[0] * size[1];
        let weights =
            Array2::from_shape_vec((size[0], size[1]), values[offset..offset + length].to_vec())
                .map_err(|error| error.to_string())?;
        offset += length;
        let biases = Array1::from_vec(values[offset..offset + size[1]].to_vec());
        offset += size[1];
        layers.push(DenseLayer::from_parameters(weights, biases));
    }
    Ok(builder(layers))
}

#[wasm_bindgen]
pub struct DigitModel {
    network: Sequential,
}

#[wasm_bindgen]
impl DigitModel {
    #[wasm_bindgen(constructor)]
    pub fn new(bytes: &[u8]) -> Result<DigitModel, JsValue> {
        load_model(bytes)
            .map(|network| Self { network })
            .map_err(|error| JsValue::from_str(&error))
    }

    pub fn predict(&self, pixels: &[f64]) -> Result<Vec<f64>, JsValue> {
        if pixels.len() != 784
            || pixels
                .iter()
                .any(|v| !v.is_finite() || !(0.0..=1.0).contains(v))
        {
            return Err(JsValue::from_str(
                "Expected 784 grayscale values between 0 and 1",
            ));
        }
        let input = Array2::from_shape_vec((1, 784), pixels.to_vec())
            .unwrap()
            .into_dyn();
        self.network
            .predict(&input)
            .map(|output| output.iter().copied().collect())
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exported_model_preserves_predictions_and_rejects_corruption() {
        let bytes = include_bytes!("../../../public/demos/neural-network/model.bin");
        let model = load_model(bytes).unwrap();
        let roundtrip = load_model(&export_model(&model)).unwrap();
        let input = Array2::from_shape_fn((1, 784), |(_, i)| (i % 13) as f64 / 13.0).into_dyn();
        assert_eq!(
            model.predict(&input).unwrap(),
            roundtrip.predict(&input).unwrap()
        );
        assert!(load_model(&bytes[..10]).is_err());
        let mut invalid = bytes.to_vec();
        invalid[4..12].copy_from_slice(&f64::NAN.to_le_bytes());
        assert!(load_model(&invalid).is_err());
    }
}
