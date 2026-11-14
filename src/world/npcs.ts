import * as THREE from 'three';
import type { Game } from '../game';
import { NPC_IDS, NPCS, SHOP, type NpcDef, type NpcId } from '../data/npcs';
import { rollTitan, TITANS } from '../data/titans';
import { autoBend, buildHumanoid, type Humanoid } from '../enemies/humanoid';
import { angDiff, lerp } from '../core/rng';
import { storeSave } from '../core/save';
import { applyContractEvent, currentContract, type Contract, type ContractEvent, type Reward } from '../systems/contracts';

const REACH = 3.6;

export interface NpcOption {
  key: string;
  text: string;
  sub: string;
  off: boolean;
}

export interface NpcView {
  name: string;
  role: string;
  greet: string;
  options: NpcOption[];
  note: string;
}

interface Body {
  def: NpcDef;
  x: number;
  y: number;
  z: number;
  h: Humanoid;
  marker: THREE.Mesh;
  yaw: number;
}

export function rewardText(r: Reward) {
  const parts = [`${r.coins} av puanı`];
  if (r.spears) parts.push(`${r.spears} patlar mızrak`);
  if (r.needle) parts.push(r.needle === 'random' ? 'mühürlü iğne' : TITANS[r.needle].needle);
  return parts.join(' + ');
}

/** Sur içindeki kişiler: satıcıdan eşya alınır, görev verenlerden sözleşme alınır. */
export class Npcs {
  /** Konuşma penceresi açık olan kişi. */
  open: NpcId | null = null;
  readonly list: Body[] = [];

  constructor(private readonly game: Game) {
    const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
    const cloth = new THREE.MeshLambertMaterial({ color: 0x7a2230 });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const gem = new THREE.OctahedronGeometry(0.2, 0);
    for (const id of NPC_IDS) {
      const def = NPCS[id];
      // Bina içine denk gelirse yakındaki boş bir noktaya kaydır.
      let x = def.x;
      let z = def.z;
      for (let i = 0; i < 12 && game.world.solidAt(x, game.world.heightAt(x, z) + 1, z, 1.6); i++) {
        x = def.x + Math.sin(i * 2.4) * (3 + i * 1.5);
        z = def.z + Math.cos(i * 2.4) * (3 + i * 1.5);
      }
      const y = game.world.heightAt(x, z);
      const L = def.look;
      const h = buildHumanoid(
        1.76,
        { skin: L.skin, top: L.top, sleeve: L.top, legs: L.legs, boots: 0x4a3222, hair: L.hair, hairStyle: L.hairStyle, eye: L.eye },
        { style: 'human', outline: 0.0048, head: 1.03 },
      );
      h.root.position.set(x, y, z);
      h.root.rotation.y = def.yaw;
      game.scene.add(h.root);
      // Tezgâh: kişinin önünde bir masa ve üstünde örtü.
      const fx = Math.sin(def.yaw);
      const fz = Math.cos(def.yaw);
      const table = new THREE.Mesh(box, wood);
      table.scale.set(2.4, 0.9, 0.9);
      table.position.set(x + fx * 1.1, y + 0.45, z + fz * 1.1);
      table.rotation.y = def.yaw;
      table.castShadow = true;
      const top = new THREE.Mesh(box, def.shop ? cloth : wood);
      top.scale.set(2.5, 0.06, 1);
      top.position.set(table.position.x, y + 0.93, table.position.z);
      top.rotation.y = def.yaw;
      game.scene.add(table, top);
      const marker = new THREE.Mesh(gem, new THREE.MeshBasicMaterial({ color: 0xffe07a, fog: false }));
      marker.position.set(x, y + 2.45, z);
      game.scene.add(marker);
      this.list.push({ def, x, y, z, h, marker, yaw: def.yaw });
    }
  }

  private get states() {
    return this.game.save.contracts;
  }

  /** Oyuncunun konuşabileceği kadar yakınındaki kişi. */
  near(pos: THREE.Vector3) {
    for (const b of this.list) {
      if (Math.hypot(b.x - pos.x, b.z - pos.z) < REACH && Math.abs(b.y - pos.y) < 3) return b.def;
    }
    return null;
  }

  tryOpen() {
    const p = this.game.player;
    const def = p.mode === 'foot' ? this.near(p.pos) : null;
    if (!def) return false;
    this.open = def.id;
    p.moveTarget = null;
    this.game.audio.pickup();
    return true;
  }

  /** Pencere açıkken tuşlar: rakamlar seçenekleri seçer, E ya da Esc kapatır. */
  keys() {
    const g = this.game;
    const inp = g.input;
    const id = this.open;
    if (!id) return;
    if (inp.pressed('KeyE') || inp.pressed('Escape')) {
      this.open = null;
      return;
    }
    const def = NPCS[id];
    for (let i = 0; i < 6; i++) {
      if (!inp.pressed(`Digit${i + 1}`)) continue;
      if (def.shop) this.buy(i);
      else if (i === 0) this.accept(def);
    }
  }

  private buy(i: number) {
    const g = this.game;
    const p = g.player;
    const item = SHOP[i];
    if (!item) return;
    if (g.save.coins < item.price) {
      g.hud.toast(`Av puanın yetmiyor — ${item.price} gerek`);
      g.audio.clang();
      return;
    }
    const full =
      (item.id === 'spear' && p.spears >= p.maxSpears) ||
      (item.id === 'medic' && p.hp >= p.maxHp) ||
      (item.id === 'blade' && p.blades >= p.maxBlades) ||
      (item.id === 'gas' && p.gas >= p.maxGas);
    if (full) {
      g.hud.toast('Buna şu an ihtiyacın yok');
      return;
    }
    g.save.coins -= item.price;
    if (item.id === 'spear') p.spears = Math.min(p.maxSpears, p.spears + 2);
    else if (item.id === 'medic') p.hp = p.maxHp;
    else if (item.id === 'blade') p.blades = p.maxBlades;
    else if (item.id === 'gas') p.gas = p.maxGas;
    else {
      const form = item.id === 'needle' ? 'ofke' : rollTitan(Math.random());
      g.meter.addNeedle(form);
      g.hud.toast(`${TITANS[form].needle} → ${TITANS[form].name}`);
    }
    g.audio.pickup();
    g.hud.toast(`${item.name} alındı  −${item.price} av puanı`);
    storeSave(g.save);
  }

  private accept(def: NpcDef) {
    const g = this.game;
    const s = this.states[def.id];
    if (s.active || def.contracts.length === 0) return;
    s.active = true;
    s.progress = 0;
    const c = currentContract(def.contracts, s);
    g.audio.pickup();
    g.hud.banner('SÖZLEŞME ALINDI', c.title);
    storeSave(g.save);
    this.open = null;
  }

  /** Oyun olayını etkin sözleşmelere işler; tamamlananın ödülünü verir. */
  emit(e: ContractEvent) {
    const g = this.game;
    for (const id of NPC_IDS) {
      const def = NPCS[id];
      const done = applyContractEvent(def.contracts, this.states[id], e);
      if (!done) continue;
      this.give(done);
      g.hud.banner('SÖZLEŞME TAMAMLANDI', `${done.title} — ${rewardText(done.reward)}`);
      g.audio.levelUp();
      storeSave(g.save);
    }
  }

  private give(c: Contract) {
    const g = this.game;
    const p = g.player;
    const r = c.reward;
    g.grantCoins(r.coins);
    if (r.spears) p.spears = Math.min(p.maxSpears, p.spears + r.spears);
    if (r.needle) g.meter.addNeedle(r.needle === 'random' ? rollTitan(Math.random()) : r.needle);
  }

  /** HUD için etkin sözleşmeler. */
  active() {
    const out: { giver: string; title: string; progress: number; goal: number }[] = [];
    for (const id of NPC_IDS) {
      const s = this.states[id];
      const def = NPCS[id];
      if (!s.active || def.contracts.length === 0) continue;
      const c = currentContract(def.contracts, s);
      out.push({ giver: def.name.split(' ').pop()!, title: c.title, progress: s.progress, goal: c.goal });
    }
    return out;
  }

  view(): NpcView | null {
    const id = this.open;
    if (!id) return null;
    const g = this.game;
    const def = NPCS[id];
    const options: NpcOption[] = [];
    let note = '';
    if (def.shop) {
      SHOP.forEach((it, i) => options.push({ key: String(i + 1), text: it.name, sub: `${it.desc} · ◆ ${it.price}`, off: g.save.coins < it.price }));
      note = `Av puanın: ◆ ${g.save.coins}`;
    } else {
      const s = this.states[id];
      const c = currentContract(def.contracts, s);
      if (s.active) {
        note = `Sürüyor: ${c.title} — ${s.progress}/${c.goal}. ${c.text}`;
      } else {
        options.push({ key: '1', text: `${c.title} — kabul et`, sub: `${c.text} Ödül: ${rewardText(c.reward)}`, off: false });
        note = s.index > 0 ? `Tamamladığın sözleşme: ${s.index}` : 'Sözleşme bitince ödül kendiliğinden verilir; geri dönmen gerekmez.';
      }
    }
    return { name: def.name, role: def.role, greet: def.greet, options, note };
  }

  update(dt: number) {
    const g = this.game;
    const p = g.player.pos;
    const now = performance.now() * 0.001;
    if (this.open) {
      const b = this.list.find((x) => x.def.id === this.open)!;
      if (Math.hypot(b.x - p.x, b.z - p.z) > REACH + 2.5 || g.player.dead) this.open = null;
    }
    for (const b of this.list) {
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d > 140) continue;
      // Oyuncu yaklaşınca ona döner; uzaktayken tezgâhına bakar.
      const want = d < 9 ? Math.atan2(p.x - b.x, p.z - b.z) : b.def.yaw;
      b.yaw += angDiff(want, b.yaw) * Math.min(1, dt * 4);
      const h = b.h;
      h.root.rotation.y = b.yaw;
      const br = Math.sin(now * 1.6 + b.x);
      const k = 1 - Math.exp(-dt * 8);
      const talking = this.open === b.def.id;
      // Nefes alır; konuşurken bir eliyle işaret eder.
      h.tilt.rotation.x = lerp(h.tilt.rotation.x, 0.02 + br * 0.012, k);
      h.tilt.rotation.z = lerp(h.tilt.rotation.z, Math.sin(now * 0.5 + b.z) * 0.025, k);
      h.armL.rotation.x = lerp(h.armL.rotation.x, 0.05 + br * 0.03, k);
      h.armR.rotation.x = lerp(h.armR.rotation.x, talking ? -0.9 + Math.sin(now * 3) * 0.15 : 0.05 - br * 0.02, k);
      h.armL.rotation.z = lerp(h.armL.rotation.z, -0.08, k);
      h.armR.rotation.z = lerp(h.armR.rotation.z, 0.08, k);
      h.head.rotation.x = lerp(h.head.rotation.x, talking ? Math.sin(now * 2.2) * 0.06 : 0, k);
      autoBend(h, k, { elbowR: talking ? -1.2 : undefined });
      const s = this.states[b.def.id];
      b.marker.position.y = b.y + 2.45 + Math.sin(now * 2.4 + b.x) * 0.08;
      b.marker.rotation.y += dt * 1.8;
      (b.marker.material as THREE.MeshBasicMaterial).color.setHex(b.def.shop ? 0x2ee6a6 : s.active ? 0x8fb4c8 : 0xffe07a);
    }
  }
}
