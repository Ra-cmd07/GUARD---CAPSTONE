const { v2: cloudinary } = require('cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dhhxctw08',
  api_key: '966894197122486',
  api_secret: 'HOKZDDJhRNF7cMaC_lgDSZFtEz8',
});

async function testUpload() {
  try {
    console.log('🧪 Testing Cloudinary upload...\n');
    
    // Create a simple test image (1x1 pixel red PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    
    console.log('📤 Uploading test image to Cloudinary...');
    const result = await cloudinary.uploader.upload(
      `data:image/png;base64,${testImageBase64}`,
      {
        folder: 'attendbox/scans',
        public_id: `test_${Date.now()}`,
        resource_type: 'image',
      }
    );
    
    console.log('\n✅ SUCCESS! Upload worked!');
    console.log('\n📋 Upload Result:');
    console.log('   URL:', result.secure_url);
    console.log('   Public ID:', result.public_id);
    console.log('   Format:', result.format);
    console.log('   Size:', result.bytes, 'bytes');
    
    console.log('\n🌐 Try opening this URL in your browser:');
    console.log('   ', result.secure_url);
    
    console.log('\n✅ Cloudinary integration is working correctly!');
    
  } catch (error) {
    console.error('\n❌ FAILED! Cloudinary upload error:');
    console.error('   ', error.message);
    if (error.error) {
      console.error('   Details:', error.error);
    }
  }
}

testUpload();
