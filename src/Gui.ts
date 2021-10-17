import { VoxelType } from "./Voxel";
import Player from "./Player";

export default class Gui {
  container = document.body;
  list: HTMLDivElement;
  tilesheet = "assets/textures/tilesheet.png";

  player: Player;

  constructor(player: Player) {
    this.player = player;
    this.createBlockList();
  }

  createBlockList() {
    this.list = document.createElement("div");
    this.list.classList.add("block-list");
    this.container.appendChild(this.list);

    for (let i = VoxelType.AIR + 1; i < VoxelType.MOSSY_STONE_BRICKS; i++) {
      this.list.appendChild(this.createBlock(i));
    }

    this.list.children[0].classList.add("selected");

    window.addEventListener("keydown", (e) => {
      if (e.code === "ArrowLeft") {
        this.player.selectedBlockType--;
        if (this.player.selectedBlockType <= 0) this.player.selectedBlockType = VoxelType.GRASS;

        Array.from(this.list.children).forEach((e) => e.classList.remove("selected"));
        this.list.children[this.player.selectedBlockType - 1].classList.add("selected");
      } else if (e.code === "ArrowRight") {
        this.player.selectedBlockType++;
        if (this.player.selectedBlockType > VoxelType.CRACKED_STONE_BRICKS)
          this.player.selectedBlockType = VoxelType.CRACKED_STONE_BRICKS;

        Array.from(this.list.children).forEach((e) => e.classList.remove("selected"));
        this.list.children[this.player.selectedBlockType - 1].classList.add("selected");
      }
    });
  }

  createBlock(id: VoxelType) {
    const block = document.createElement("button");
    block.classList.add("block");
    block.style.backgroundImage = `url(${this.tilesheet})`;
    block.style.backgroundPositionY = `-${41.7 * (id - 1)}px`;
    block.addEventListener("click", () => {
      this.player.selectedBlockType = id;
      Array.from(this.list.children).forEach((e) => e.classList.remove("selected"));
      block.classList.add("selected");
    });
    return block;
  }
}
