/**
 * Facility (site) type for 2-level destination modelling: Partner → Facility.
 * Each facility belongs to a partner and accepts specific waste streams in a region.
 */

export type Facility = {
  id: string;
  name: string;
  type: string;
  partner_id: string;
  region: string;
  accepted_streams: string[];
  address?: string | null;
};
