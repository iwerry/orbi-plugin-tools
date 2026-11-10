//! orbi-engine — motor da Orbi Plugin Tools (Draft Creative Studio Ltda).
//! Toda a lógica pesada e testável dos plugins mora aqui; os painéis do
//! Premiere/After Effects chamam o binário `orbi-engine` e recebem JSON.

pub mod audio;
pub mod autocut;
pub mod beats;
pub mod captions;
pub mod cube;
pub mod guides;
pub mod library;
pub mod sfx;
pub mod silence;
pub mod xmeml;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
