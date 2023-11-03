# Reserve an external IP
resource "google_compute_address" "website" {
  provider = google
  name     = "website-lb-ip"
  network_tier = "STANDARD"
}

# Get the managed DNS zone
data "google_dns_managed_zone" "rekry" {
  provider = google
  name     = "jussizoje"
}

# Add the IP to the DNS
resource "google_dns_record_set" "website" {
  provider     = google
  name         = "rekry.${data.google_dns_managed_zone.rekry.dns_name}"
  type         = "A"
  ttl          = 300
  managed_zone = data.google_dns_managed_zone.rekry.name
  rrdatas      = [google_compute_address.website.address]
}