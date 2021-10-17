import { BoxBufferGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import Engine from "./Engine";
import World from "./World";
import Voxel, { Neighbours, VoxelType } from "./Voxel";

export default class Player {
  height = 2;
  width = 0.8;
  walkForce = 5;
  friction = 25;
  jumpForce = 6.8;
  weight = 20;
  acceleration = 80;
  velocity = new Vector3(0, 0, 0);
  lastPosition = new Vector3();
  maxVelocity = new Vector3(5, 20, 5);
  // cameraPos = new Vector3(0, 0, 4);
  cameraPos = new Vector3(0, this.height / 4, 0);
  object: Mesh;
  noClip = false;

  lastPlaceTime = 0;
  placeLimit = 200;
  lastDestroyTime = 0;
  destroyLimit = 200;
  blockRange = 5;

  selectedBlockType = VoxelType.GRASS;

  constructor(x: number, y: number, z: number) {
    const geometry = new BoxBufferGeometry(this.width, this.height, this.width);
    const material = new MeshBasicMaterial({ color: 0x0000ff });
    this.object = new Mesh(geometry, material);

    this.object.position.set(x, y + this.height, z);
    this.lastPosition.copy(this.object.position);
  }

  init() {
    Engine.renderScene.add(this.object);
    Engine.camera.position.copy(this.object.position).add(this.cameraPos);
  }

  update() {
    const keyController = Engine.keyController;
    const mouseController = Engine.mouseController;
    const delta = Engine.getDelta();

    // copy camera rotation to player
    this.object.rotation.y = Engine.camera.rotation.y;

    // player movement
    let moveF = false;
    let moveB = false;
    let moveL = false;
    let moveR = false;
    const isOnGround = this.isOnGround(delta);
    let acceleration = this.acceleration * (isOnGround ? 1 : 0.1);
    let maxVelocity = this.maxVelocity.clone();

    // place / destroy blocks
    if (mouseController.mouse.isPressed) {
      const time = performance.now();
      switch (mouseController.mouse.button) {
        case 0:
          if (time - this.lastDestroyTime > this.destroyLimit) {
            this.lastDestroyTime = time;
            this.setSelectedVoxel();
          }
          break;
        case 2:
          if (time - this.lastPlaceTime > this.placeLimit) {
            this.lastPlaceTime = time;
            this.setSelectedVoxel(true, this.selectedBlockType);
          }
          break;
      }
    }

    // sprint
    if (keyController.isKeyPressed("ShiftLeft")) {
      acceleration *= 1.2;
      maxVelocity.multiplyScalar(1.5);
    }

    // movement
    if (keyController.isKeyPressed("KeyW")) {
      moveF = true;
      this.velocity.z += acceleration * delta;
      if (Math.abs(this.velocity.z) > maxVelocity.z)
        this.velocity.z = maxVelocity.z * Math.sign(this.velocity.z);
    }
    if (keyController.isKeyPressed("KeyS")) {
      moveB = true;
      this.velocity.z -= acceleration * delta;
      if (Math.abs(this.velocity.z) > maxVelocity.z)
        this.velocity.z = maxVelocity.z * Math.sign(this.velocity.z);
    }
    if (keyController.isKeyPressed("KeyA")) {
      moveL = true;
      this.velocity.x -= acceleration * delta;
      if (Math.abs(this.velocity.x) > maxVelocity.x)
        this.velocity.x = maxVelocity.x * Math.sign(this.velocity.x);
    }
    if (keyController.isKeyPressed("KeyD")) {
      moveR = true;
      this.velocity.x += acceleration * delta;
      if (Math.abs(this.velocity.x) > maxVelocity.x)
        this.velocity.x = maxVelocity.x * Math.sign(this.velocity.x);
    }

    // ensure consistent movement in all directions
    // this.direction.x = Number(moveR) - Number(moveL);
    // this.direction.z = Number(moveF) - Number(moveB);
    // this.direction.normalize();

    // this.velocity.x *= this.direction.x * Math.sign(this.velocity.x);
    // this.velocity.z *= this.direction.z * Math.sign(this.velocity.z);

    // apply friction
    const friction = this.friction * (isOnGround ? 1 : 0.05);
    const sign = {
      x: Math.sign(this.velocity.x),
      y: Math.sign(this.velocity.y),
      z: Math.sign(this.velocity.z),
    };

    if (!moveL && !moveR) {
      this.velocity.x -= sign.x * friction * delta;
      if (Math.sign(this.velocity.x) !== sign.x) this.velocity.x = 0;
    }
    if (!moveF && !moveB) {
      this.velocity.z -= sign.z * friction * delta;
      if (Math.sign(this.velocity.z) !== sign.z) this.velocity.z = 0;
    }

    // jump
    if (isOnGround && !this.noClip && keyController.isKeyPressed("Space")) {
      this.velocity.y = this.jumpForce;
    } else if (this.noClip) {
      if (keyController.isKeyPressed("Space")) {
        this.velocity.y = this.jumpForce;
      } else if (keyController.isKeyPressed("ShiftLeft")) {
        this.velocity.y = -this.jumpForce;
      } else {
        this.velocity.y = 0;
      }
    } else if (!isOnGround) {
      this.velocity.y -= this.weight * delta;
      if (Math.abs(this.velocity.y) > this.maxVelocity.y)
        this.velocity.y = this.maxVelocity.y * Math.sign(this.velocity.y);
    }

    if (!this.noClip) this.collide(delta);
    this.lastPosition.copy(this.object.position);

    // update positions
    this.object.position.y += this.velocity.y * delta;
    Engine.camera.position.copy(this.object.position).add(this.cameraPos);

    Engine.mouseController.controls.moveRight(this.velocity.x * delta);
    Engine.mouseController.controls.moveForward(this.velocity.z * delta);
    this.object.position.copy(Engine.camera.position).sub(this.cameraPos);

    this.collide(delta);
    Engine.camera.position.copy(this.object.position).add(this.cameraPos);
  }

  setSelectedVoxel(outside = false, id = VoxelType.AIR) {
    const vox = this.findSelectedVoxel(outside);
    if (!vox) return;
    else if (!vox.getChunk) Object.setPrototypeOf(vox, Voxel.prototype);

    vox.id = id;

    const world = <World>Engine.currScene;
    const { chunkX, chunkY } = vox.getChunk(world.chunkSize, world.chunkOffset);
    const chunk = world.chunks[chunkY][chunkX];

    const key = `${chunkX} ${chunkY}`;
    if (world.replaceChunks[key]) world.replaceChunks[key]++;
    else world.replaceChunks[key] = 1;
    world.requestChunkGeometry(chunk, chunkX, chunkY);

    // const cn = world.getChunkNeighbours(chunkX, chunkY);
    // const n = vox.getNeighbours(world.chunks[chunkY][chunkX], cn, world.chunkGeneratorOptions.bedrock);

    // Object.keys(n).forEach((k) => {
    //   if (!n[k]) return;
    //   const { chunkX: ncx, chunkY: ncy } = vox.getChunk(world.chunkSize, world.chunkOffset);
    //   if (ncx !== chunkX || ncy !== chunkY) {
    //     const chunk = world.chunks[ncy][ncx];
    //     const key = `${ncx} ${ncy}`;
    //     if (world.replaceChunks[key]) world.replaceChunks[key]++;
    //     else world.replaceChunks[key] = 1;
    //     world.requestChunkGeometry(chunk, ncx, ncy);
    //   }
    // });
  }

  private findSelectedVoxel(outside: boolean = false) {
    const world = <World>Engine.currScene;

    const ray = new Raycaster(
      Engine.camera.position,
      Engine.camera.getWorldDirection(new Vector3()),
      0,
      this.blockRange
    );
    const point = ray.intersectObjects(world.renderedMeshes)[0]?.point;
    if (point) {
      point
        .add(Engine.camera.getWorldDirection(new Vector3()).divideScalar(1000 * (outside ? -1 : 1)))
        .floor();

      const vox = world.getVoxel(point.x, point.y, point.z);

      // check if voxel collides with player
      if (
        !vox ||
        (vox.x === Math.floor(this.object.position.x) &&
          vox.y >= Math.floor(this.object.position.y) - this.height / 2 &&
          vox.y < Math.floor(this.object.position.y) + this.height / 2 &&
          vox.z === Math.floor(this.object.position.z))
      ) {
        return undefined;
      }

      return vox;
    }

    return undefined;
  }

  collide(delta: number) {
    const globalVelocity = this.object.position.clone().sub(this.lastPosition);
    const world = <World>Engine.currScene;

    // top is center voxel
    const feet = this.getCollidingVoxels(
      this.object.position.x,
      Math.floor(this.object.position.y - this.height / 2),
      this.object.position.z
    );

    const head = this.getCollidingVoxels(
      this.object.position.x,
      Math.floor(this.object.position.y + this.height / 2 - world.voxelSize / 10),
      this.object.position.z
    );

    this.collideWithVoxels(feet, globalVelocity, world.voxelSize, true);
    this.collideWithVoxels(head, globalVelocity, world.voxelSize, false);
  }

  private collideWithVoxels(
    vox: Neighbours<Voxel>,
    globalVelocity: Vector3,
    voxelSize: number,
    down: boolean
  ) {
    if (down && globalVelocity.y < 0 && vox.top && vox.top.id !== 0) {
      this.velocity.y = 0;
      this.object.position.y = vox.top.y + this.height;
      // console.log(this.object.position.y);
      return;
    }
    if (!down && globalVelocity.y > 0 && vox.top && vox.top.id !== 0) {
      this.velocity.y = 0;
      this.object.position.y = vox.top.y - voxelSize;

      return;
    }

    let left = false;
    let right = false;
    let front = false;
    let back = false;

    // moving x
    if (globalVelocity.x < 0 && vox.left && vox.left.id !== 0) {
      left = true;
      this.velocity.x = 0;
      this.object.position.x = vox.left.x + voxelSize + this.width / 2;
    } else if (globalVelocity.x > 0 && vox.right && vox.right.id !== 0) {
      right = true;
      this.velocity.x = 0;
      this.object.position.x = vox.right.x - this.width / 2;
    }
    // console.log(collide, this.velocity.x, globalVelocity.x);

    // moving z
    if (globalVelocity.z < 0 && vox.front && vox.front.id !== 0) {
      front = true;
      this.velocity.z = 0;
      this.object.position.z = vox.front.z + voxelSize + this.width / 2;
    } else if (globalVelocity.z > 0 && vox.back && vox.back.id !== 0) {
      back = true;
      this.velocity.z = 0;
      this.object.position.z = vox.back.z - this.width / 2;
    }

    // diagonals
    // if (!front && !left && (globalVelocity.z < 0 || globalVelocity.x < 0) && vox.fl && vox.fl.id !== 0) {
    //   this.velocity.z = 0;
    //   this.velocity.x = 0;
    //   this.object.position.z = vox.fl.z + voxelSize + this.width / 2;
    //   this.object.position.x = vox.fl.x + voxelSize + this.width / 2;
    // } else if (
    //   !front &&
    //   !right &&
    //   (globalVelocity.z < 0 || globalVelocity.x > 0) &&
    //   vox.fr &&
    //   vox.fr.id !== 0
    // ) {
    //   this.velocity.z = 0;
    //   this.velocity.x = 0;
    //   this.object.position.z = vox.fr.z + voxelSize + this.width / 2;
    //   this.object.position.x = vox.fr.x - this.width / 2;
    // } else if (
    //   !back &&
    //   !left &&
    //   (globalVelocity.z > 0 || globalVelocity.x < 0) &&
    //   vox.bl &&
    //   vox.bl.id !== 0
    // ) {
    //   this.velocity.z = 0;
    //   this.velocity.x = 0;
    //   this.object.position.x = vox.bl.z - this.width / 2;
    //   this.object.position.z = vox.bl.x + voxelSize + this.width / 2;
    // } else if (
    //   !back &&
    //   !right &&
    //   (globalVelocity.z > 0 || globalVelocity.x > 0) &&
    //   vox.br &&
    //   vox.br.id !== 0
    // ) {
    //   this.velocity.z = 0;
    //   this.velocity.x = 0;
    //   this.object.position.x = vox.br.z - this.width / 2;
    //   this.object.position.z = vox.br.z - this.width / 2;
    // }
  }

  private getCollidingVoxels(x: number, y: number, z: number): Neighbours<Voxel> {
    const world = <World>Engine.currScene;

    const fx = Math.floor(x);
    const fz = Math.floor(z);

    const neighbours: Neighbours<Voxel> = {
      top: world.getVoxel(fx, y, fz),
      left: world.getVoxel(Math.floor(this.object.position.x - this.width / 2), y, fz),
      right: world.getVoxel(Math.floor(this.object.position.x + this.width / 2), y, fz),
      front: world.getVoxel(fx, y, Math.floor(this.object.position.z - this.width / 2)),
      back: world.getVoxel(fx, y, Math.floor(this.object.position.z + this.width / 2)),
      fl: world.getVoxel(
        Math.floor(this.object.position.x - this.width / 2),
        y,
        Math.floor(this.object.position.z - this.width / 2)
      ),
      fr: world.getVoxel(
        Math.floor(this.object.position.x + this.width / 2),
        y,
        Math.floor(this.object.position.z - this.width / 2)
      ),
      bl: world.getVoxel(
        Math.floor(this.object.position.x - this.width / 2),
        y,
        Math.floor(this.object.position.z + this.width / 2)
      ),
      br: world.getVoxel(
        Math.floor(this.object.position.x + this.width / 2),
        y,
        Math.floor(this.object.position.z + this.width / 2)
      ),
    };

    return neighbours;
  }

  isOnGround(delta: number): boolean {
    const world = <World>Engine.currScene;

    const vox = world.getVoxel(
      Math.floor(this.object.position.x),
      Math.floor(this.object.position.y - this.height / 2 - world.voxelSize / 5),
      Math.floor(this.object.position.z)
    );

    return vox && vox.id !== 0;
  }

  getChunk() {
    const world = <World>Engine.currScene;
    const chunkX = Math.floor(this.object.position.x / world.chunkSize + world.chunkOffset);
    const chunkY = Math.floor(this.object.position.z / world.chunkSize + world.chunkOffset);

    return {
      chunk: world.chunks[chunkY] ? world.chunks[chunkY][chunkX] : undefined,
      chunkX,
      chunkY,
    };
  }
}
