import ChunkGenerator from "./ChunkGenerator";

const ctx: Worker = self as any;
let generator: ChunkGenerator;

// Respond to message from parent thread
ctx.onmessage = (ev) => {
  const { msg, data } = ev.data;

  switch (msg) {
    case "createGenerator":
      const { seed, options } = data;
      generator = new ChunkGenerator(seed, options);
      break;
    case "requestGeneration":
      if (generator) {
        const { x, y } = data;
        const c = generator.generateChunk(x, y);
        ctx.postMessage({ msg: "chunk", data: { x, y, c } });
      }
      break;
  }
};
