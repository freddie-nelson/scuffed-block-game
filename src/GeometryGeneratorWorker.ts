import GeometryGenerator from "./GeometryGenerator";

const ctx: Worker = self as any;
let generator: GeometryGenerator;

// Respond to message from parent thread
ctx.onmessage = (ev) => {
  const { msg, data } = ev.data;

  switch (msg) {
    case "createGenerator":
      generator = new GeometryGenerator(data);
      break;
    case "requestGeometry":
      if (generator) {
        const geo = generator.generateChunkGeometry(data.chunk);
        const { positions, uvs, normals, indices } = generator.convertGeoToTypedArrs(geo);
        ctx.postMessage(
          { msg: "geometry", data: { x: data.x, y: data.y, indices, positions, uvs, normals } },
          [positions.buffer, uvs.buffer, normals.buffer]
        );
      }
      break;
  }
};
