import { describe, expect, it } from 'vitest';
import { parseIngredient } from '../ingredients';

describe('parseIngredient', () => {
  it.each([
    ['2 dl havregryn', 'havregryn', 70],
    ['1 gul lök, finhackad', 'gul lök', 100],
    ['1 paket kycklingfilé (ca 500 g)', 'kycklingfilé', 500],
    ['1 burk krossade tomater', 'krossade tomater', 400],
    ['3-4 morötter', 'morötter', 245],
    ['150 g riven ost', 'ost', 150],
    ['4 äggulor (Från Sverige)', 'äggulor', 72],
    ['65 g babygrönkål', 'grönkål', 65],
    ['1 ½ dl grädde', 'grädde', 150],
  ])('%s', (line, name, grams) => {
    const parsed = parseIngredient(line);
    expect(parsed.name).toBe(name);
    expect(parsed.grams).toBeCloseTo(grams, 0);
  });

  it('leaves amount-less lines without a weight', () => {
    expect(parseIngredient('Salt och peppar').grams).toBeNull();
  });
});
