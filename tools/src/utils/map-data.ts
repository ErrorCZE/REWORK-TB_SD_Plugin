/**
 * Get map data based on location ID and PVE/PVP mode
 */
export function getMapData(locationId: string | null, pveMode: boolean): any | null {
	if (!locationId) {
		return null;
	}

	const dataSource = pveMode ? globalThis.locationsDataPVE : globalThis.locationsDataPVP;

	if (!dataSource) {
		return null;
	}

	return dataSource.find((map: any) => map.nameId === locationId) || null;
}
