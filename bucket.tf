resource "google_storage_bucket" "website" {
  provider = google
  name     = "rekry-website"
  location = "EUROPE-NORTH1"
  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

# Make new objects public
resource "google_storage_default_object_access_control" "website_read" {
  bucket = google_storage_bucket.website.name
  role   = "READER"
  entity = "allUsers"
}

resource "null_resource" "upload_folder_content" {

  triggers = {

    file_hashes = jsonencode({

    for fn in fileset(var.folder_path, "**") :

    fn => filesha256("${var.folder_path}/${fn}")

    })

  }

  provisioner "local-exec" {

    command = "gsutil cp -r ${var.folder_path}/* gs://${google_storage_bucket.website.name}/"

  }

}