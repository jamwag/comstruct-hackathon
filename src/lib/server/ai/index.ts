// AI services for product classification and data mapping
export { classifyProduct, classifyProducts } from './classify-product';
export type { ClassificationResult, CategoryInfo, ConstructionTypeInfo } from './classify-product';

export { mapCsvColumns, applyMappings } from './map-csv-columns';
export type { ColumnMapping, MappingResult } from './map-csv-columns';
