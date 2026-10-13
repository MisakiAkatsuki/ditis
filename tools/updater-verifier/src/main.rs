// Match tauri-plugin-updater's PublicKey::decode / Signature::decode / verify.
use minisign_verify::{PublicKey, Signature};
use std::{env, fs};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 4 {
        return Err("expected decoded public-key file, artifact, decoded signature file".into());
    }
    let public_key = PublicKey::decode(&fs::read_to_string(&args[1])?)?;
    let signature = Signature::decode(&fs::read_to_string(&args[3])?)?;
    public_key.verify(&fs::read(&args[2])?, &signature, true)?;
    println!("Updater signature verified against the application's public key");
    Ok(())
}
