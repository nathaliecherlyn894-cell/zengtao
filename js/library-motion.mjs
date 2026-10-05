// 速度以基础速度为单位，距离按秒累计，独立于渲染帧率。
export class FlightMotion {
    constructor() {
        this.speed = 1;
        this.cameraPull = 0;
        this.posePull = 0;
        this.offset = 0;
        this.length = 108;
        this.pressed = false;
        this.holdTime = 0;
    }

    press() {
        this.pressed = true;
        this.holdTime = 0;
    }

    release() {
        this.pressed = false;
        this.holdTime = 0;
    }

    update(dt) {
        dt = Math.min(Math.max(dt, 0), 0.05);
        if (this.pressed) this.holdTime += dt;
        const target = this.pressed && this.holdTime >= 0.2 ? 4 : 1;
        const cameraTarget = target === 4 ? 1 : 0;
        this.cameraPull += (cameraTarget - this.cameraPull) * (1 - Math.exp(-dt * (cameraTarget ? 4 : 3)));
        if (Math.abs(cameraTarget - this.cameraPull) < 0.0001) this.cameraPull = cameraTarget;
        this.posePull += (cameraTarget - this.posePull) * (1 - Math.exp(-dt * (cameraTarget ? 2 : 1.5)));
        if (Math.abs(cameraTarget - this.posePull) < 0.0001) this.posePull = cameraTarget;
        this.speed += (target - this.speed) * (1 - Math.exp(-dt * 5));
        this.offset = (this.offset + dt * this.speed * 1.4) % this.length;
    }
}
