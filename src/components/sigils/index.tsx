import type { KingdomKey } from "@/lib/kingdoms";
import type { SigilProps } from "./types";
import { IronSigil } from "./iron-sigil";
import { WisdomSigil } from "./wisdom-sigil";
import { BondsSigil } from "./bonds-sigil";
import { BuildersSigil } from "./builders-sigil";
import { TreasurySigil } from "./treasury-sigil";
import { TempleSigil } from "./temple-sigil";

export const KINGDOM_SIGIL: Record<KingdomKey, (props: SigilProps) => React.JSX.Element> = {
  fitness: IronSigil,
  learning: WisdomSigil,
  relationships: BondsSigil,
  career: BuildersSigil,
  money: TreasurySigil,
  mind: TempleSigil,
};

export {
  IronSigil,
  WisdomSigil,
  BondsSigil,
  BuildersSigil,
  TreasurySigil,
  TempleSigil,
};
export type { SigilProps };
