export class CharacterController {
  constructor(scene, x, y) {
    this.scene = scene;
    this.speed = 2.5;
    this.currentDir = "S";
    this.isMoving = false;

    this.sprite = scene.add.sprite(x, y, "hero_idle", 0).setScale(0.8);
    this.shadow = scene.add.image(x, y + 30, "shadow").setScale(0.6).setAlpha(0.4);

    this.createAnimations();
  }

  createAnimations() {
    const dirs = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
    for (let i = 0; i < 8; i++) {
      const dir = dirs[i];
      this.scene.anims.create({
        key: `walk_${dir}`,
        frames: this.scene.anims.generateFrameNumbers("hero_walk", {
          start: i, end: i + 24, step: 8,
        }),
        frameRate: 10,
        repeat: -1,
      });
      this.scene.anims.create({
        key: `idle_${dir}`,
        frames: [{ key: "hero_idle", frame: i }],
        frameRate: 1,
      });
    }
  }

  getDirection(vx, vy) {
    const deg = (Math.atan2(vy, vx) * 180 / Math.PI + 360) % 360;
    if (deg >= 337.5 || deg < 22.5) return "E";
    if (deg < 67.5)  return "SE";
    if (deg < 112.5) return "S";
    if (deg < 157.5) return "SW";
    if (deg < 202.5) return "W";
    if (deg < 247.5) return "NW";
    if (deg < 292.5) return "N";
    return "NE";
  }

  move(vx, vy) {
    this.isMoving = vx !== 0 || vy !== 0;

    if (this.isMoving) {
      this.sprite.x += vx * this.speed;
      this.sprite.y += vy * this.speed;
      this.shadow.x = this.sprite.x;
      this.shadow.y = this.sprite.y + 30;

      this.currentDir = this.getDirection(vx, vy);

      const animKey = `walk_${this.currentDir}`;
      if (this.sprite.anims.currentAnim?.key !== animKey) {
        this.sprite.play(animKey, true);
      }
    } else {
      const idleKey = `idle_${this.currentDir}`;
      if (this.sprite.anims.currentAnim?.key !== idleKey) {
        this.sprite.play(idleKey);
      }
    }

    this.sprite.setDepth(this.sprite.y);
    this.shadow.setDepth(this.sprite.y - 1);
  }

  syncFromServer(data) {
    this.sprite.x = data.x;
    this.sprite.y = data.y;
    this.currentDir = data.dir;
    this.sprite.play(data.isMoving ? `walk_${data.dir}` : `idle_${data.dir}`, true);
  }
}
