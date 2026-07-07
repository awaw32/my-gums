import { CharacterController } from "./CharacterController.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("Game");
  }

  preload() {
    this.load.spritesheet("hero_walk", "../assets/hero_walk.png", { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet("hero_idle", "../assets/hero_idle.png", { frameWidth: 256, frameHeight: 256 });
    this.load.image("shadow", "../assets/shadow.png");
  }

  create() {
    this.player = new CharacterController(this, 400, 300);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
  }

  update() {
    let vx = 0;
    let vy = 0;

    // isometric mapping: up=NW, down=SE, left=SW, right=NE
    if (this.cursors.left.isDown || this.wasd.A.isDown) { vx -= 1; vy += 1; }
    if (this.cursors.right.isDown || this.wasd.D.isDown) { vx += 1; vy -= 1; }
    if (this.cursors.up.isDown || this.wasd.W.isDown) { vx -= 1; vy -= 1; }
    if (this.cursors.down.isDown || this.wasd.S.isDown) { vx += 1; vy += 1; }

    // normalise diagonals
    if (vx !== 0 && vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len;
      vy /= len;
    }

    this.player.move(vx, vy);
  }
}
