const earthRadiusKm = 6371

export function distanceKm(
  first: { lng: number; lat: number },
  second: { lng: number; lat: number },
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDifference = toRadians(second.lat - first.lat)
  const longitudeDifference = toRadians(second.lng - first.lng)
  const firstLatitude = toRadians(first.lat)
  const secondLatitude = toRadians(second.lat)

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(Math.min(1, haversine)))
}
