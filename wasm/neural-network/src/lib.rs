use nn_lib::{
    activation::Activation,
    cost::CostFunction,
    initialization::InitializerType,
    layers::{ActivationLayer, DenseLayer},
    optimizer::GradientDescent,
    sequential::{Sequential, SequentialBuilder},
    tensor::{Device, Tensor},
};
use wasm_bindgen::prelude::*;

const SIZES: [usize; 3] = [784, 128, 10];
const MAGIC: &[u8; 4] = b"MNQ1";

fn load_model(bytes: &[u8]) -> Result<Sequential, String> {
    let count: usize = SIZES.windows(2).map(|s| s[0] * s[1] + s[1] * 8).sum();
    if bytes.len() != MAGIC.len() + count || &bytes[..MAGIC.len()] != MAGIC {
        return Err("Invalid MNIST model file".into());
    }
    let mut offset = MAGIC.len();
    let mut builder = SequentialBuilder::new();
    for (index, size) in SIZES.windows(2).enumerate() {
        let vector_bytes = size[1] * 4;
        let scales = read_floats(&bytes[offset..offset + vector_bytes])?;
        if scales.iter().any(|&scale| scale <= 0.0) {
            return Err("Invalid model scale".into());
        }
        offset += vector_bytes;
        let bias = Tensor::new(
            read_floats(&bytes[offset..offset + vector_bytes])?,
            vec![size[1]],
            Device::CPU,
        )
        .map_err(|error| error.to_string())?;
        offset += vector_bytes;
        let weight_count = size[0] * size[1];
        let values: Vec<f32> = bytes[offset..offset + weight_count]
            .iter()
            .enumerate()
            .map(|(i, &value)| f32::from(value as i8) * scales[i % size[1]])
            .collect();
        if values.iter().any(|value| !value.is_finite()) {
            return Err("Non-finite model parameter".into());
        }
        offset += weight_count;
        let weights =
            Tensor::new(values, size.to_vec(), Device::CPU).map_err(|error| error.to_string())?;
        let mut dense = DenseLayer::new(size[0], size[1], InitializerType::He, Device::CPU)
            .map_err(|error| error.to_string())?;
        dense.set_weights(weights);
        dense.set_bias(bias);
        builder = builder
            .push(dense)
            .push(ActivationLayer::from(if index == SIZES.len() - 2 {
                Activation::Softmax
            } else {
                Activation::ReLU
            }));
    }
    builder
        .compile(GradientDescent::new(0.0), CostFunction::CrossEntropy)
        .map_err(|error| error.to_string())
}

fn read_floats(bytes: &[u8]) -> Result<Vec<f32>, String> {
    bytes
        .as_chunks::<4>()
        .0
        .iter()
        .map(|chunk| {
            let value = f32::from_le_bytes(*chunk);
            if value.is_finite() {
                Ok(value)
            } else {
                Err("Non-finite model parameter".into())
            }
        })
        .collect()
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

    pub fn predict(&self, pixels: &[f32]) -> Result<Vec<f32>, JsValue> {
        if pixels.len() != SIZES[0]
            || pixels
                .iter()
                .any(|v| !v.is_finite() || !(0.0..=1.0).contains(v))
        {
            return Err(JsValue::from_str(
                "Expected 784 grayscale values between 0 and 1",
            ));
        }
        let input = Tensor::new(pixels.to_vec(), vec![1, SIZES[0]], Device::CPU)
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        self.network
            .predict(&input)
            .and_then(|output| output.to_vec().map_err(Into::into))
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }
}
