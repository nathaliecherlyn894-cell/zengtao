import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const source = new URL('../js/library-motion.mjs', import.meta.url);
test('图书馆运动模块存在', () => assert.ok(existsSync(source), '需要实现运动模块'));
if (existsSync(source)) {
    const { FlightMotion } = await import(source);
    const advance = (motion, seconds, hz = 60) => {
        for (let i = 0; i < seconds * hz; i++) motion.update(1 / hz);
    };
    test('短按不加速，长按平滑加速且不超过四倍', () => {
        const motion = new FlightMotion();
        motion.press();
        advance(motion, 0.1);
        assert.equal(motion.speed, 1);
        advance(motion, 1);
        assert.ok(motion.speed > 3.7 && motion.speed <= 4);
        advance(motion, 10);
        assert.ok(motion.speed <= 4);
    });
    test('释放后平滑减速，中断后不会再次自动加速', () => {
        const motion = new FlightMotion();
        motion.press(); advance(motion, 2);
        const fast = motion.speed;
        motion.release();
        assert.equal(motion.speed, fast);
        advance(motion, 0.1);
        assert.ok(motion.speed < fast && motion.speed > 1);
        advance(motion, 2);
        assert.ok(motion.speed < 1.01);
        assert.equal(motion.pressed, false);
    });
    test('不同帧率的运动距离一致且长期运行不会超出循环长度', () => {
        const a = new FlightMotion(); const b = new FlightMotion();
        advance(a, 10, 30); advance(b, 10, 120);
        assert.ok(Math.abs(a.offset - b.offset) < 0.00001);
        advance(a, 300);
        assert.ok(a.offset >= 0 && a.offset < a.length);
    });
    test('镜头初始不拉远，短按不会改变镜头', () => {
        const motion = new FlightMotion();
        assert.equal(motion.cameraPull, 0);
        motion.press();
        advance(motion, 0.1);
        assert.equal(motion.cameraPull, 0);
        motion.release();
        advance(motion, 1);
        assert.equal(motion.cameraPull, 0);
    });
    test('身体转向和恢复耗时为原镜头过渡的两倍，短按仍不转向', () => {
        const motion = new FlightMotion();
        motion.press(); advance(motion, .1, 100);
        assert.equal(motion.posePull, 0);
        const original = new FlightMotion();
        motion.holdTime = original.holdTime = 1;
        original.pressed = true;
        advance(original, .8, 100); advance(motion, 1.6, 100);
        assert.ok(Math.abs(motion.posePull - original.cameraPull) < 1e-10);
        motion.posePull = original.cameraPull = 1;
        motion.release(); original.release();
        advance(original, 1, 100); advance(motion, 2, 100);
        assert.ok(Math.abs(motion.posePull - original.cameraPull) < 1e-10);
        const before = motion.posePull;
        motion.press();
        assert.equal(motion.posePull, before, '再次按压不重置姿态');
    });
    test('长按达到门槛后镜头平滑拉远并保持在零到一之间', () => {
        const motion = new FlightMotion();
        motion.press();
        advance(motion, 0.19, 100);
        assert.equal(motion.cameraPull, 0);
        motion.update(0.01);
        assert.ok(motion.cameraPull > 0 && motion.cameraPull < 0.1);
        for (let i = 0; i < 80; i++) {
            const before = motion.cameraPull;
            motion.update(0.01);
            assert.ok(motion.cameraPull >= before && motion.cameraPull <= 1);
            assert.ok(motion.cameraPull - before < 0.04);
        }
        assert.ok(motion.cameraPull > 0.94);
        advance(motion, 10);
        assert.equal(motion.cameraPull, 1);
    });
    test('释放立即保持镜头位置，一秒内平滑恢复并最终归零', () => {
        const motion = new FlightMotion();
        motion.press();
        advance(motion, 2);
        const pulled = motion.cameraPull;
        assert.ok(pulled > 0.94);
        motion.release();
        assert.equal(motion.cameraPull, pulled);
        motion.update(1 / 60);
        assert.ok(motion.cameraPull < pulled && motion.cameraPull > 0);
        advance(motion, 1);
        assert.ok(motion.cameraPull > 0 && motion.cameraPull < 0.06);
        advance(motion, 10);
        assert.equal(motion.cameraPull, 0);
        assert.equal(motion.pressed, false);
    });
    test('快速再次按下从当前镜头位置衔接并重新等待长按门槛', () => {
        const motion = new FlightMotion();
        motion.press();
        advance(motion, 1);
        motion.release();
        advance(motion, 0.1);
        const returning = motion.cameraPull;
        assert.ok(returning > 0 && returning < 1);
        motion.press();
        assert.equal(motion.cameraPull, returning);
        advance(motion, 0.1);
        assert.ok(motion.cameraPull < returning && motion.cameraPull > 0);
        advance(motion, 0.1);
        const resumed = motion.cameraPull;
        motion.update(1 / 60);
        assert.ok(motion.cameraPull > resumed && motion.cameraPull < 1);
        assert.ok(motion.cameraPull - resumed < 0.1);
    });
}
