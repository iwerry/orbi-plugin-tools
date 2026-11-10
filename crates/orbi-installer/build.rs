// Garante que dist/ exista (o payload é embutido com include_dir!) e, no
// Windows, embute um manifesto que pede elevação de administrador.
fn main() {
    let dist = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../dist");
    if !dist.join("extensions").exists() {
        std::fs::create_dir_all(dist.join("extensions")).unwrap();
        println!("cargo:warning=dist/ vazio — rode `node tools/build.mjs` antes de compilar o instalador.");
    }
    println!("cargo:rerun-if-changed=../../dist");
    if std::env::var_os("CARGO_CFG_WINDOWS").is_some() {
        use embed_manifest::{embed_manifest, manifest::ExecutionLevel, new_manifest};
        embed_manifest(new_manifest("DraftCreativeStudio.OrbiPluginToolsSetup").requested_execution_level(ExecutionLevel::RequireAdministrator))
            .expect("não consegui embutir o manifesto");
    }
}
