import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { CHARACTERS, CHAR_IDS } from '../data/characters';
import { BLOODS } from '../player/bloodline';

describe('kan soyları', () => {
  it('Çelik Soyu uyanınca daha hızlı ve az gazla ilerler; uyanış süreli ve beklemelidir', () => {
    const C = CFG.blood.celik;
    expect(C.move).toBeGreaterThan(1);
    expect(C.boost).toBeGreaterThan(1);
    expect(C.reel).toBeGreaterThan(1);
    expect(C.maxSpeed).toBeGreaterThan(1);
    expect(C.gas).toBeLessThan(1);
    expect(C.cd).toBeGreaterThan(C.dur);
  });

  it('Taç Soyu kükreyince bazen süreli dost dönüşümcüler çağırır', () => {
    const T = CFG.blood.tac;
    expect(T.chance).toBeGreaterThan(0);
    expect(T.chance).toBeLessThan(1);
    expect(T.count).toBeGreaterThan(0);
    expect(T.dur).toBeGreaterThan(10);
  });

  it('her iki soyun da sahibi var; soylar adlarıyla tanımlı', () => {
    const owners = CHAR_IDS.filter((id) => CHARACTERS[id].blood);
    expect(owners.filter((id) => CHARACTERS[id].blood === 'celik').length).toBeGreaterThan(0);
    expect(owners.filter((id) => CHARACTERS[id].blood === 'tac').length).toBeGreaterThan(0);
    // Taç Soyu'nun sahiplerinin kendi formunda bir kükreyiş vardır.
    expect(CHARACTERS.yigit.blood).toBe('tac');
    expect(BLOODS.celik.name).toBe('Çelik Soyu');
    expect(BLOODS.tac.name).toBe('Taç Soyu');
    expect(CHARACTERS.aras.blood).toBeUndefined();
  });
});
