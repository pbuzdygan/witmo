import { Controller, Get, Param, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { SearchMoviesQueryDto } from './dto/search-movies-query.dto';
import { MovieParamsDto } from './dto/movie-params.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('api')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get('search')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  search(@Query() query: SearchMoviesQueryDto) {
    return this.moviesService.searchMovies(query);
  }

  @Get('movie/:imdbId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  findOne(@Param() params: MovieParamsDto) {
    return this.moviesService.getMovieByImdbId(params.imdbId);
  }
}
