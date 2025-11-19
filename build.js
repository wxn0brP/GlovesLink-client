import esbuild from "esbuild";

esbuild.build({
    entryPoints: ["./src/index.ts"],
    bundle: true,
    outfile: "./dist/GlovesLinkClient.js",
    platform: "browser",
    format: "esm",
    sourcemap: true,
    minify: true,
    metafile: true,
    external: ["ws"]
}).then(() => {
    console.log("Build complete");
}).catch(err => {
    console.error(err);
    process.exit(1);
});
