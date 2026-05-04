import type {CatalogBootstrap} from '../../../services/catalogService';

export interface ICatalogRepository {
  fetchBootstrap: () => Promise<CatalogBootstrap>;
  warmMenuImages: (
    catalog: CatalogBootstrap,
    wireRow: Record<string, unknown> | null,
  ) => Promise<void>;
}
