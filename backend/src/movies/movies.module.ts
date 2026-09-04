import { Module } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { OmdbService } from '../external/omdb/omdb.service';
import { TmdbService } from '../external/tmdb/tmdb.service';

@Module({
  controllers: [MoviesController],
  providers: [MoviesService, OmdbService, TmdbService],
})
export class MoviesModule {}
