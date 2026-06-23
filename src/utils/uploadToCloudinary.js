const cloudinary = require("../config/cloudinary");

const uploadToCloudinary = (fileBuffer, folder = process.env.CLOUDINARY_FOLDER || "busnet", options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: options.resource_type || "auto",
      ...options
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

module.exports = uploadToCloudinary;