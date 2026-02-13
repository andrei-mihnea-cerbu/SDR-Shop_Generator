export interface ArtistRow {
  id: string;
  name: string;
  type: string;
  website: string | null;
  bio: string | null;
  isActive: number;
  archivePath: string | null;
  productionPrice: number;
  hasAvatar: number;
  hasLogo: number;
  hasFavicon: number;
}

export interface ArtistEntity {
  id: string;
  name: string;
  type: string;
  website?: string;
  bio?: string;
  isActive: boolean;
  hasAvatar: boolean;
  hasLogo: boolean;
  hasFavicon: boolean;
}

export interface ArtistApiDto {
  id: string;
  name: string;
  type: string;
  website?: string;
  isActive: boolean;
  archivePath?: string;
  bio?: string;
  productionPrice: number;
  avatarDataUri?: string;
  logoDataUri?: string;
  faviconDataUri?: string;
}
