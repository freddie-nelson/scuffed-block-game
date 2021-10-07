import { BoxBufferGeometry, Mesh, MeshBasicMaterial, Vector3 } from "three";
import Engine from "./Engine";
import World from "./scenes/World";
import Voxel, { Neighbours } from "./Voxel";

export default class Player {
  height = 2;
  width = 1;
  walkForce = 5;
  friction = 60;
  jumpForce = 6;
  weight = 12;
  acceleration = 120;
  velocity = new Vector3(0, 0, 0);
  lastPosition = new Vector3();
  maxVelocity = new Vector3(5, 20, 5);
  // cameraPos = new Vector3(0, 0, 4);
  cameraPos = new Vector3(0, this.height / 4, 0);
  object: Mesh;
  noClip = false;

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
    const delta = Engine.getDelta();

    // copy camera rotation to player
    this.object.rotation.y = Engine.camera.rotation.y;

    // player movement
    let moveF = false;
    let moveB = false;
    let moveL = false;
    let moveR = false;
    const isOnGround = this.isOnGround(delta);
    const acceleration = this.acceleration * (isOnGround ? 1 : 0.1);

    if (keyController.isKeyPressed("KeyW")) {
      moveF = true;
      this.velocity.z += acceleration * delta;
      if (Math.abs(this.velocity.z) > this.maxVelocity.z)
        this.velocity.z = this.maxVelocity.z * Math.sign(this.velocity.z);
    }
    if (keyController.isKeyPressed("KeyS")) {
      moveB = true;
      this.velocity.z -= acceleration * delta;
      if (Math.abs(this.velocity.z) > this.maxVelocity.z)
        this.velocity.z = this.maxVelocity.z * Math.sign(this.velocity.z);
    }
    if (keyController.isKeyPressed("KeyA")) {
      moveL = true;
      this.velocity.x -= acceleration * delta;
      if (Math.abs(this.velocity.x) > this.maxVelocity.x)
        this.velocity.x = this.maxVelocity.x * Math.sign(this.velocity.x);
    }
    if (keyController.isKeyPressed("KeyD")) {
      moveR = true;
      this.velocity.x += acceleration * delta;
      if (Math.abs(this.velocity.x) > this.maxVelocity.x)
        this.velocity.x = this.maxVelocity.x * Math.sign(this.velocity.x);
    }

    // ensure consistent movement in all directions
    // this.direction.x = Number(moveR) - Number(moveL);
    // this.direction.z = Number(moveF) - Number(moveB);
    // this.direction.normalize();

    // this.velocity.x *= this.direction.x * Math.sign(this.velocity.x);
    // this.velocity.z *= this.direction.z * Math.sign(this.velocity.z);

    // apply friction
    const sign = {
      x: Math.sign(this.velocity.x),
      y: Math.sign(this.velocity.y),
      z: Math.sign(this.velocity.z),
    };

    if (!moveL && !moveR) {
      this.velocity.x -= sign.x * this.friction * delta;
      if (Math.sign(this.velocity.x) !== sign.x) this.velocity.x = 0;
    }
    if (!moveF && !moveB) {
      this.velocity.z -= sign.z * this.friction * delta;
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

    // update camera position then move player to camera
    Engine.mouseController.controls.moveRight(this.velocity.x * delta);
    Engine.mouseController.controls.moveForward(this.velocity.z * delta);
    this.object.position.copy(Engine.camera.position).sub(this.cameraPos);
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
      Math.floor(this.object.position.y + this.height / 2),
      this.object.position.z
    );

    this.collideWithVoxels(feet, globalVelocity, world.voxelSize);
    this.collideWithVoxels(head, globalVelocity, world.voxelSize);
  }

  private collideWithVoxels(vox: Neighbours<Voxel>, globalVelocity: Vector3, voxelSize: number) {
    // falling
    if (globalVelocity.y < 0 && vox.top && vox.top.id !== 0) {
      this.velocity.y = 0;
      this.object.position.y = vox.top.y + this.height;
      // console.log(this.object.position.y);
    }

    // moving x
    if (globalVelocity.x < 0 && vox.left && vox.left.id !== 0) {
      this.velocity.x = 0;
      this.object.position.x = vox.left.x + voxelSize + this.width / 2;
    } else if (globalVelocity.x > 0 && vox.right && vox.right.id !== 0) {
      this.velocity.x = 0;
      this.object.position.x = vox.right.x - this.width / 2;
    }

    // moving z
    if (globalVelocity.z < 0 && vox.front && vox.front.id !== 0) {
      this.velocity.z = 0;
      this.object.position.z = vox.front.z + voxelSize + this.width / 2;
    } else if (globalVelocity.z > 0 && vox.back && vox.back.id !== 0) {
      this.velocity.z = 0;
      this.object.position.z = vox.back.z - this.width / 2;
    }
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
}
