import { IsIn } from 'class-validator';

export const SKINS = ['default', 'harbor', 'foundry', 'meadow'] as const;
export type Skin = (typeof SKINS)[number];

export class SetSkinDto {
  @IsIn(SKINS)
  skin!: Skin;
}
