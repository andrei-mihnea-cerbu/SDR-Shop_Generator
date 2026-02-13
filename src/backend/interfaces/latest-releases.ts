export interface LatestYouTubeRelease {
  videoId: string;
  title: string;
  viewCount: number;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface LatestSpotifyRelease {
  name: string;
  spotifyUrl: string;
  imageUrl: string | null;
}

export interface LatestReleasesApiDto {
  youtube?: LatestYouTubeRelease | null;
  spotify?: LatestSpotifyRelease | null;
}

export interface LatestReleasesEntity {
  youtube: LatestYouTubeRelease | null;
  spotify: LatestSpotifyRelease | null;
}

export interface LatestReleasesRow {
  artistId: string;
  youtube: string | null;
  spotify: string | null;
}
