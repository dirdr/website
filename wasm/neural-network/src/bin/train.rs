use ndarray::{Array2, ArrayD};
use nn_lib::{
    activation::Activation,
    cost::CostFunction,
    initialization::InitializerType,
    layer::{ActivationLayer, DenseLayer},
    optimizer::GradientDescent,
    sequential::SequentialBuilder,
};
use portfolio_mnist::{export_model, load_model, SIZES};
use std::{error::Error, fs, path::Path};

fn dataset(path: &Path, prefix: &str) -> Result<(ArrayD<f64>, ArrayD<f64>), Box<dyn Error>> {
    let images = fs::read(path.join(format!("{prefix}-images-idx3-ubyte")))?;
    let labels = fs::read(path.join(format!("{prefix}-labels-idx1-ubyte")))?;
    if images[..4] != [0, 0, 8, 3] || labels[..4] != [0, 0, 8, 1] {
        return Err("Expected uncompressed MNIST IDX files".into());
    }
    let n = u32::from_be_bytes(labels[4..8].try_into()?) as usize;
    if images.len() != 16 + n * 784 || labels.len() != n + 8 {
        return Err("Invalid MNIST dimensions".into());
    }
    let x = Array2::from_shape_vec(
        (n, 784),
        images[16..].iter().map(|v| *v as f64 / 255.0).collect(),
    )?;
    let y = Array2::from_shape_fn((n, 10), |(i, c)| {
        if labels[i + 8] as usize == c {
            1.0
        } else {
            0.0
        }
    });
    Ok((x.into_dyn(), y.into_dyn()))
}

fn accuracy(network: &nn_lib::sequential::Sequential, x: &ArrayD<f64>, y: &ArrayD<f64>) -> f64 {
    let mut correct = 0;
    for start in (0..x.shape()[0]).step_by(100) {
        let end = (start + 100).min(x.shape()[0]);
        let output = network
            .predict(&x.slice(ndarray::s![start..end, ..]).to_owned().into_dyn())
            .unwrap();
        for (i, row) in output.outer_iter().enumerate() {
            let digit = row
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.total_cmp(b.1))
                .unwrap()
                .0;
            correct += usize::from(y[[start + i, digit]] == 1.0);
        }
    }
    correct as f64 / x.shape()[0] as f64
}

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();
    let path = Path::new(
        args.get(1)
            .ok_or("Usage: train <MNIST raw directory> <output directory> [epochs]")?,
    );
    let output = Path::new(args.get(2).ok_or("Missing output directory")?);
    let epochs = args.get(3).map(|s| s.parse()).transpose()?.unwrap_or(15);
    let (x, y) = dataset(path, "train")?;
    let (test_x, test_y) = dataset(path, "t10k")?;
    let mut builder = SequentialBuilder::new();
    for (i, size) in SIZES.windows(2).enumerate() {
        builder = builder
            .push(DenseLayer::new(
                size[0],
                size[1],
                if i == 2 {
                    InitializerType::GlorotUniform
                } else {
                    InitializerType::He
                },
            ))
            .push(ActivationLayer::from(if i == 2 {
                Activation::Softmax
            } else {
                Activation::ReLU
            }));
    }
    let mut network = builder.compile(GradientDescent::new(0.04), CostFunction::CrossEntropy)?;
    for epoch in 1..=epochs {
        let (history, _) = network.train((&x, &y), None, 1, 100)?;
        println!(
            "epoch {epoch}/{epochs}: loss={:.5}",
            history.history[0].loss
        );
    }
    fs::create_dir_all(output)?;
    let bytes = export_model(&network);
    fs::write(output.join("model.bin"), &bytes)?;
    let restored = load_model(&bytes)?;
    let score = accuracy(&restored, &test_x, &test_y);
    println!("Exported model test accuracy: {:.2}%", score * 100.0);
    fs::write(output.join("model-info.json"), format!("{{\"architecture\":[784,256,256,10],\"epochs\":{epochs},\"batchSize\":100,\"learningRate\":0.04,\"testAccuracy\":{score},\"testExamples\":10000,\"trainingExamples\":60000,\"augmentation\":false,\"sourceRevision\":\"3bad77a01a17f817071cf21b7090eabe0805e035\"}}\n"))?;
    let labels = fs::read(path.join("t10k-labels-idx1-ubyte"))?;
    let images = fs::read(path.join("t10k-images-idx3-ubyte"))?;
    let mut examples = Vec::new();
    for digit in 0..10 {
        let i = labels[8..].iter().position(|v| *v == digit).unwrap();
        examples.extend_from_slice(&images[16 + i * 784..16 + (i + 1) * 784]);
    }
    fs::write(output.join("examples.bin"), examples)?;
    Ok(())
}
