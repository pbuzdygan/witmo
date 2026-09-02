import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class MovieParamsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^tt\d{7,10}$/)
  imdbId!: string;
}
