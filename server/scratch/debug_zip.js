const { sequelize, Event, File, DownloadLog } = require('../src/models');
const storageService = require('../src/services/storageService');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function debugZip() {
  console.log('===========================================================');
  console.log(' RUNNING STAGESYNC ZIP PACKAGER DIAGNOSTIC');
  console.log('===========================================================');

  try {
    // 1. Check database connection
    await sequelize.authenticate();
    console.log('✓ Database connection successful.');

    // 2. Fetch all active events
    const events = await Event.findAll();
    console.log(`Found ${events.length} event(s) in database.`);
    
    if (events.length === 0) {
      console.log('❌ No events found in database. Diagnostic aborted.');
      return;
    }

    const event = events[0];
    console.log(`Targeting Event: "${event.name}" (ID: ${event.id}, PublicID: ${event.public_id})`);

    // 3. Fetch files for this event
    const files = await File.findAll({
      where: { event_id: event.id, upload_status: 'READY' }
    });
    console.log(`Found ${files.length} file(s) with status = READY.`);

    if (files.length === 0) {
      console.log('❌ No READY files found for this event. Diagnostic aborted.');
      return;
    }

    // Print file paths
    for (const f of files) {
      const filePath = storageService.getLocalFilePath(f.storage_key);
      const exists = filePath ? fs.existsSync(filePath) : false;
      console.log(`- File: "${f.display_name}"`);
      console.log(`  Storage Key: "${f.storage_key}"`);
      console.log(`  Resolved Path: "${filePath}"`);
      console.log(`  Physical File Exists: ${exists ? 'YES' : '❌ NO'}`);
    }

    // 4. Attempt to run packaging block in memory (writing to a temporary file)
    console.log('\n[Test] Running ZIP archive packaging block...');
    const outPath = path.join(__dirname, 'test_output.zip');
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`✓ ZIP archive generated successfully: ${archive.pointer()} total bytes.`);
        console.log(`  Temporary ZIP saved to: ${outPath}`);
        fs.unlinkSync(outPath); // Clean up
        resolve();
      });

      archive.on('error', (err) => {
        console.error('❌ Archiver error callback fired:', err);
        reject(err);
      });

      archive.pipe(output);

      for (const file of files) {
        if (process.env.STORAGE_PROVIDER === 's3') {
          console.log(`- Appending stream for S3 key: ${file.storage_key}`);
          // MOCKED stream appender (skip fetch if credentials aren't set)
        } else {
          const filePath = storageService.getLocalFilePath(file.storage_key);
          if (filePath && fs.existsSync(filePath)) {
            console.log(`- Appending local file: ${file.display_name}`);
            archive.file(filePath, { name: file.display_name });
          } else {
            console.log(`⚠️ Warning: Physical file missing for key "${file.storage_key}". Skipping.`);
          }
        }
      }

      console.log('Finalizing archive...');
      archive.finalize();
    });

  } catch (error) {
    console.error('\n❌ DIAGNOSTIC ENCOUNTERED RUNTIME EXCEPTION:');
    console.error(error.stack || error);
  } finally {
    await sequelize.close();
    console.log('===========================================================');
  }
}

debugZip();
