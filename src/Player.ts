import { BoxBufferGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import Engine from "./Engine";

export default class Player {
  height = 2;
  width = 1;
  acceleration = 160;
  friction = 60;
  jumpForce = 6;
  weight = 12;
  velocity = new Vector3(0, 0, 0);
  maxVelocity = new Vector3(5, 20, 5);
  cameraPos = new Vector3(4, 2, 0);
  object: Mesh;
  noClip = false;

  constructor(x: number, y: number, z: number) {
    const geometry = new BoxBufferGeometry(this.width, this.height, this.width);
    const material = new MeshBasicMaterial({ color: 0x0000ff });
    this.object = new Mesh(geometry, material);
    this.object.position.set(x, y + this.height, z);
  }

  init() {
    Engine.renderScene.add(this.object);
    this.object.add(Engine.camera);
    Engine.camera.position.copy(this.cameraPos);
  }

  update() {
    const keyController = Engine.keyController;
    const delta = Engine.getDelta();

    // player movement
    let movedX = false;
    let movedZ = false;
    const isOnGround = this.isOnGround(delta);
    const acceleration = this.acceleration * (isOnGround ? 1 : 0.3);

    if (keyController.isKeyPressed("KeyA")) {
      movedX = true;
      this.velocity.x -= acceleration * delta;
      if (Math.abs(this.velocity.x) > this.maxVelocity.x)
        this.velocity.x = this.maxVelocity.x * Math.sign(this.velocity.x);
    }
    if (keyController.isKeyPressed("KeyD")) {
      movedX = true;
      this.velocity.x += acceleration * delta;
      if (Math.abs(this.velocity.x) > this.maxVelocity.x)
        this.velocity.x = this.maxVelocity.x * Math.sign(this.velocity.x);
    }
    if (keyController.isKeyPressed("KeyW")) {
      movedZ = true;
      this.velocity.z += acceleration * delta;
      if (Math.abs(this.velocity.z) > this.maxVelocity.z)
        this.velocity.z = this.maxVelocity.z * Math.sign(this.velocity.z);
    }
    if (keyController.isKeyPressed("KeyS")) {
      movedZ = true;
      this.velocity.z -= acceleration * delta;
      if (Math.abs(this.velocity.z) > this.maxVelocity.z)
        this.velocity.z = this.maxVelocity.z * Math.sign(this.velocity.z);
    }

    // apply friction
    const sign = {
      x: Math.sign(this.velocity.x),
      y: Math.sign(this.velocity.y),
      z: Math.sign(this.velocity.z),
    };

    if (!movedX) {
      this.velocity.x -= sign.x * this.friction * delta;
      if (Math.sign(this.velocity.x) !== sign.x) this.velocity.x = 0;
    }
    if (!movedZ) {
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

    // update positions
    this.object.position.y += this.velocity.y * delta;
    Engine.mouseController.controls.moveForward(this.velocity.z * delta);
    Engine.mouseController.controls.moveRight(this.velocity.x * delta);

    // sync player and camera position
    this.object.position.add(Engine.camera.position.clone().sub(this.cameraPos));
    Engine.camera.position.copy(this.cameraPos);

    this.collide(delta);
  }

  collide(delta: number) {
    const diff = this.velocity.clone().multiplyScalar(delta);

    // y casts
    const diffY = this.height / 2 + Math.abs(diff.y);
    if (diff.y < 0) {
      const raycaster = new Raycaster(this.object.position, new Vector3(0, -1, 0), 0, diffY);
      const intersections = raycaster.intersectObjects(Engine.currScene.collidables);
      if (intersections.length > 0) this.velocity.y = 0;
    } else if (diff.y > 0) {
      const raycaster = new Raycaster(this.object.position, new Vector3(0, 1, 0), 0, diffY);
      const intersections = raycaster.intersectObjects(Engine.currScene.collidables);
      if (intersections.length > 0) this.velocity.y = 0;
    }

    // x casts
    const diffX = this.width / 2 + Math.abs(diff.x);
    if (diff.x < 0) {
      const raycaster = new Raycaster(this.object.position, new Vector3(0, 0, 1), 0, diffX);
      const intersections = raycaster.intersectObjects(Engine.currScene.collidables);
      console.log("X", intersections[0]?.point);
      if (intersections.length > 0) this.velocity.x = 0;
    } else if (diff.x > 0) {
      const raycaster = new Raycaster(this.object.position, new Vector3(0, 0, 1), 0, diffX);
      const intersections = raycaster.intersectObjects(Engine.currScene.collidables);
      if (intersections.length > 0) this.velocity.x = 0;
    }

    // z casts
    const diffZ = this.width / 2 + Math.abs(diff.z);
    if (diff.z < 0) {
      const raycaster = new Raycaster(this.object.position, new Vector3(-1, 0, 0), 0, diffZ);
      const intersections = raycaster.intersectObjects(Engine.currScene.collidables);
      console.log("Z", intersections[0]?.point);
      if (intersections.length > 0) this.velocity.z = 0;
    } else if (diff.z > 0) {
      const raycaster = new Raycaster(this.object.position, new Vector3(1, 0, 0), 0, diffZ);
      const intersections = raycaster.intersectObjects(Engine.currScene.collidables);
      if (intersections.length > 0) this.velocity.z = 0;
    }
  }

  isOnGround(delta: number): boolean {
    const raycaster = new Raycaster(
      this.object.position,
      new Vector3(0, -1, 0),
      0,
      this.height / 2 + this.velocity.y * delta
    );
    const intersections = raycaster.intersectObjects(Engine.currScene.collidables);
    return intersections.length > 0;
  }
}
