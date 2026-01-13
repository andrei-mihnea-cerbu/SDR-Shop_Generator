export interface Webmail {
  url: string;
  email: string;
  password: string;
}

export interface Artist {
  id: string;
  name: string;
  type: ArtistType;
  website?: string;
  webmail: Webmail;
  logos: string[];
  favicons: string[];
}

export enum ArtistType {
  GROUP = 'group',
  INDIVIDUAL = 'individual',
}
