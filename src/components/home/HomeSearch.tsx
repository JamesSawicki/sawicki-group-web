/**
 * HomeSearch.tsx — the home page's "I'm buying" search: the map search's type-ahead box,
 * but choosing a city/ZIP opens /listings framed on it and choosing a listing opens its
 * page. Hydrated on idle (`client:idle`), so it never delays the first paint.
 */
import SearchBox from "../search/SearchBox";
import { listingPath } from "../../lib/listing-utils";
import { mapSearchPath, DEFAULT_STATUS } from "../../lib/search-filters";
import type { Listing } from "../../types/listing";

interface Props {
  /** Base URL of listing-agent-api. */
  apiBaseUrl: string;
}

export default function HomeSearch({ apiBaseUrl }: Props) {
  return (
    <SearchBox
      apiBaseUrl={apiBaseUrl}
      status={DEFAULT_STATUS}
      onSelectPlace={(place) => window.location.assign(mapSearchPath(place))}
      // listingPath reads only the address/city/ZIP/mlsId fields a summary carries.
      onSelectListing={(listing) => window.location.assign(listingPath(listing as Listing))}
    />
  );
}
