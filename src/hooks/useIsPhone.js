import { useMediaQuery } from './useMediaQuery.js';

// Phone-sized screens: the home page shows the cover picture instead of the live 3D preview.
const QUERY = '(max-width: 760px), (pointer: coarse) and (max-height: 520px)';

export function useIsPhone() {
  return useMediaQuery(QUERY);
}
