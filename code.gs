/**
 * ============================================
 * SNT DATA ASSEMBLY - GOOGLE APPS SCRIPT
 * ============================================
 * 
 * This script handles:
 * 1. Email notifications (task assignments, comments, replies, email threads)
 * 2. Data backup to Google Drive (JSON file)
 * 3. Data synchronization
 * 4. User management
 * 
 * ============================================
 * SETUP INSTRUCTIONS
 * ============================================
 * 
 * STEP 1: Create New Google Apps Script Project
 * ---------------------------------------------
 * 1. Go to https://script.google.com
 * 2. Click "+ New Project"
 * 3. Name it "SNT Data Assembly Backend"
 * 4. Delete any default code in Code.gs
 * 5. Copy and paste this ENTIRE file
 * 6. Save (Ctrl+S or Cmd+S)
 * 
 * STEP 2: Configure Settings
 * --------------------------
 * Edit the CONFIG object below with your details:
 * - ADMIN_EMAIL: Your email for error notifications
 * - PLATFORM_USERS: List of all platform users with their emails
 * 
 * STEP 3: Deploy as Web App
 * -------------------------
 * 1. Click "Deploy" button (top right)
 * 2. Select "New deployment"
 * 3. Click gear icon ⚙️ next to "Select type"
 * 4. Choose "Web app"
 * 5. Fill in:
 *    - Description: "SNT Data Assembly API v1"
 *    - Execute as: "Me (your email)"
 *    - Who has access: "Anyone"
 * 6. Click "Deploy"
 * 7. Click "Authorize access" and follow prompts
 * 8. COPY the Web app URL (looks like: https://script.google.com/macros/s/xxxxx/exec)
 * 
 * STEP 4: Connect to SNT Data Assembly
 * ------------------------------------
 * 1. Open SNT Data Assembly app
 * 2. Login as Admin (admin/admin)
 * 3. Find the yellow "Google Apps Script URL" panel
 * 4. Paste the Web app URL
 * 5. Click "Save URL"
 * 6. Click "Test Connection" to verify
 * 
 * STEP 5: Test Email (Optional)
 * -----------------------------
 * 1. In Apps Script editor, select function: "testEmailNotification"
 * 2. Click "Run" ▶️
 * 3. Check your email for test message
 * 
 * ============================================
 * IMPORTANT NOTES
 * ============================================
 * - After making changes, you must create a NEW deployment
 * - The old URL will still use old code
 * - For updates: Deploy > Manage deployments > Edit > New version
 * 
 */

// ============================================
// CONFIGURATION - EDIT THESE VALUES
// ============================================

const CONFIG = {
  // Folder name in Google Drive for backups
  BACKUP_FOLDER_NAME: 'SNT_Data_Assembly_Backup_v1',
  
  // Backup file name
  BACKUP_FILE_NAME: 'snt_data_backup_v1.json',
  
  // Your email for system notifications and errors
  ADMIN_EMAIL: 'sillahmohamedkanu@gmail.com',
  
  // Email sender name (appears in "From" field)
  SENDER_NAME: 'SNT Data Assembly',
  
  // Organization name for email footer
  ORG_NAME: 'Informatics Consultancy Firm - Sierra Leone (ICF-SL)',
  ORG_TAGLINE: 'Health Information Systems | Data Analytics | Digital Solutions',
  
  // Logo URL for email header (ICF-SL Logo)
  LOGO_URL: 'https://raw.githubusercontent.com/mohamedsillahkanu/blank-app-2/9cf4d88894d3637b6c8544eef566aead89fd238a/icf_sl%20(2).jpg',
  
  // Logo is enabled
  SHOW_LOGO: true,
  
  // URL where the SNT Data Assembly app is hosted
  APP_URL: 'https://mohamedsillahkanu.github.io/snt-data-assembly-and-communication-chanel/',
  
  // Platform users - ADD ALL YOUR USERS HERE
  // These users will receive email notifications for Email section posts
  PLATFORM_USERS: [
    { name: 'Admin', email: 'sillahmohamedkanu@gmail.com', role: 'admin' },
    { name: 'Supervisor', email: 'sillahmusakanu@gmail.com.com', role: 'supervisor' },
    { name: 'User', email: 'sillahkanu@gwu.edu', role: 'user' },
    { name: 'John Seppeh', email: 'jseppeh89@gmail.com', role: 'supervisor' }
    // Add more users as needed:
    // { name: 'John Doe', email: 'john@example.com', role: 'user' },
    // { name: 'Jane Smith', email: 'jane@example.com', role: 'supervisor' },
  ],
  
  // Enable/disable features
  ENABLE_EMAIL: true,
  ENABLE_BACKUP: true,
  ENABLE_LOGGING: true
};

// ============================================
// WEB APP HANDLERS
// ============================================

/**
 * Handle GET requests (for testing and data retrieval)
 */
function doGet(e) {
  // Handle direct execution (no parameters) - for testing
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'status';
  
  try {
    switch (action) {
      case 'test':
        return jsonResponse({
          success: true,
          message: 'Connection successful!',
          timestamp: new Date().toISOString(),
          config: {
            emailEnabled: CONFIG.ENABLE_EMAIL,
            backupEnabled: CONFIG.ENABLE_BACKUP,
            userCount: CONFIG.PLATFORM_USERS.length
          }
        });
        
      case 'getData':
        const data = loadBackupData();
        return jsonResponse({
          success: true,
          data: data,
          lastBackup: data ? data.lastUpdated : null
        });
        
      case 'getUsers':
        return jsonResponse({
          success: true,
          users: CONFIG.PLATFORM_USERS.map(u => ({
            name: u.name,
            email: u.email,
            role: u.role
          }))
        });
        
      case 'status':
      default:
        return jsonResponse({
          success: true,
          message: 'SNT Data Assembly API is running',
          version: '1.0.0',
          endpoints: {
            GET: ['?action=test', '?action=getData', '?action=getUsers', '?action=status'],
            POST: ['email', 'sync', 'backup', 'notifyAll', 'taskAssigned', 'taskCompleted', 'newComment']
          }
        });
    }
  } catch (error) {
    logError('doGet', error);
    return jsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Handle POST requests (for sending emails and syncing data)
 */
function doPost(e) {
  try {
    // Handle missing post data
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'No POST data received' });
    }
    
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    log('POST request received', { action: action });
    
    let result = { success: false, message: 'Unknown action' };
    
    switch (action) {
      // Basic email sending
      case 'email':
        result = sendEmail(data.to, data.subject, data.body, data.attachmentInfo);
        break;
        
      // Data sync/backup
      case 'sync':
        result = syncData(data.data);
        break;
        
      case 'backup':
        result = backupData(data.data);
        break;
        
      // Notify all platform users (for Email section)
      case 'notifyAll':
        result = notifyAllUsers(data.subject, data.body, data.from, data.excludeEmail);
        break;
        
      // Task assigned notification
      case 'taskAssigned':
        result = sendTaskAssignedEmail(data);
        break;
        
      // Task completed notification
      case 'taskCompleted':
        result = sendTaskCompletedEmail(data);
        break;
        
      // New comment notification
      case 'newComment':
        result = sendNewCommentEmail(data);
        break;
        
      // New reply notification
      case 'newReply':
        result = sendNewReplyEmail(data);
        break;
        
      // New item added notification
      case 'newItem':
        result = sendNewItemEmail(data);
        break;
        
      default:
        result = { success: false, message: 'Unknown action: ' + action };
    }
    
    log('POST response', result);
    return jsonResponse(result);
    
  } catch (error) {
    logError('doPost', error);
    return jsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Create JSON response
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// EMAIL FUNCTIONS
// ============================================

/**
 * Send a single email
 */
function sendEmail(to, subject, body, attachmentInfo) {
  if (!CONFIG.ENABLE_EMAIL) {
    return { success: true, message: 'Email disabled in config', skipped: true };
  }
  
  if (!to || !subject) {
    return { success: false, message: 'Missing email parameters (to, subject required)' };
  }
  
  try {
    const htmlBody = createEmailTemplate(subject, body, attachmentInfo);
    
    GmailApp.sendEmail(to, subject, body || '', {
      name: CONFIG.SENDER_NAME,
      htmlBody: htmlBody
    });
    
    log('Email sent', { to: to, subject: subject });
    return { success: true, message: 'Email sent successfully', to: to };
    
  } catch (error) {
    logError('sendEmail', error);
    return { success: false, message: 'Email failed: ' + error.toString() };
  }
}

/**
 * Notify all platform users
 */
function notifyAllUsers(subject, body, fromUser, excludeEmail) {
  if (!CONFIG.ENABLE_EMAIL) {
    return { success: true, message: 'Email disabled', skipped: true };
  }
  
  if (!subject || !body) {
    console.log('notifyAllUsers: Missing subject or body. Use testNotifyAll() to test this function.');
    return { success: false, message: 'Missing subject or body' };
  }
  
  try {
    let sentCount = 0;
    const errors = [];
    
    CONFIG.PLATFORM_USERS.forEach(user => {
      // Skip the sender
      if (excludeEmail && user.email.toLowerCase() === excludeEmail.toLowerCase()) {
        return;
      }
      
      try {
        const personalizedBody = `${fromUser || 'A user'} posted a new message:\n\n${body}`;
        sendEmail(user.email, subject, personalizedBody);
        sentCount++;
      } catch (err) {
        errors.push({ email: user.email, error: err.toString() });
      }
    });
    
    return { 
      success: true, 
      message: `Notified ${sentCount} users`, 
      sentCount: sentCount,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    logError('notifyAllUsers', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Helper function to notify ALL platform users (no exclusions)
 */
function notifyAllPlatformUsers(subject, body) {
  if (!CONFIG.ENABLE_EMAIL) {
    return { success: true, message: 'Email disabled', skipped: true };
  }
  
  try {
    let sentCount = 0;
    const errors = [];
    
    CONFIG.PLATFORM_USERS.forEach(user => {
      try {
        sendEmail(user.email, subject, body);
        sentCount++;
      } catch (err) {
        errors.push({ email: user.email, error: err.toString() });
      }
    });
    
    log('Notified all users', { subject: subject, sentCount: sentCount });
    
    return { 
      success: true, 
      message: `Notified ${sentCount} users`, 
      sentCount: sentCount,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    logError('notifyAllPlatformUsers', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Send task assigned notification - TO ALL USERS
 */
function sendTaskAssignedEmail(data) {
  // Handle direct execution without data
  if (!data) {
    console.log('sendTaskAssignedEmail: No data provided. This function is called automatically when tasks are assigned.');
    return { success: false, message: 'No data provided - this function is called by the app, not directly' };
  }
  
  const { taskTitle, dueDate, assignedBy, assignee, description } = data;
  
  const subject = `New Task Assigned: ${taskTitle}`;
  const body = `
Hello,

A new task has been assigned in SNT Data Assembly.

-------------------------------------------
TASK DETAILS
-------------------------------------------

Title: ${taskTitle}
Assigned to: ${assignee || 'Not specified'}
Due Date: ${dueDate || 'Not specified'}
Assigned by: ${assignedBy || 'System'}

Description:
${description || 'No description provided'}

-------------------------------------------

Please log in to SNT Data Assembly to view the full details.

Best regards,
${CONFIG.SENDER_NAME}
  `.trim();
  
  // Notify ALL platform users
  return notifyAllPlatformUsers(subject, body);
}

/**
 * Send task completed notification - TO ALL USERS
 */
function sendTaskCompletedEmail(data) {
  // Handle direct execution without data
  if (!data) {
    console.log('sendTaskCompletedEmail: No data provided. This function is called automatically when tasks are completed.');
    return { success: false, message: 'No data provided - this function is called by the app, not directly' };
  }
  
  const { taskTitle, completedBy, completionNotes, completionDate } = data;
  
  const subject = `Task Completed: ${taskTitle}`;
  const body = `
Hello,

A task has been marked as complete in SNT Data Assembly.

-------------------------------------------
COMPLETION DETAILS
-------------------------------------------

Task: ${taskTitle}
Completed by: ${completedBy || 'Unknown'}
Completion Date: ${completionDate || new Date().toLocaleDateString()}

Completion Notes:
${completionNotes || 'No notes provided'}

-------------------------------------------

Please log in to SNT Data Assembly to view the full details.

Best regards,
${CONFIG.SENDER_NAME}
  `.trim();
  
  // Notify ALL platform users
  return notifyAllPlatformUsers(subject, body);
}

/**
 * Send new comment notification - TO ALL USERS
 */
function sendNewCommentEmail(data) {
  // Handle direct execution without data
  if (!data) {
    console.log('sendNewCommentEmail: No data provided. This function is called automatically when comments are added.');
    return { success: false, message: 'No data provided - this function is called by the app, not directly' };
  }
  
  const { itemTitle, commenter, commentText, itemSection, hasAttachment } = data;
  
  const subject = `New Comment on: ${itemTitle}`;
  const body = `
Hello,

A new comment has been added in SNT Data Assembly.

-------------------------------------------
COMMENT DETAILS
-------------------------------------------

Item: ${itemTitle}
Section: ${itemSection || 'Unknown'}
Comment by: ${commenter || 'Unknown'}
${hasAttachment ? 'Includes attachment' : ''}

Comment:
"${commentText || 'No text'}"

-------------------------------------------

Please log in to SNT Data Assembly to view and reply.

Best regards,
${CONFIG.SENDER_NAME}
  `.trim();
  
  // Notify ALL platform users
  return notifyAllPlatformUsers(subject, body);
}

/**
 * Send new reply notification - TO ALL USERS
 */
function sendNewReplyEmail(data) {
  // Handle direct execution without data
  if (!data) {
    console.log('sendNewReplyEmail: No data provided. This function is called automatically when replies are added.');
    return { success: false, message: 'No data provided - this function is called by the app, not directly' };
  }
  
  const { itemTitle, replier, replyText, originalCommenter, hasAttachment } = data;
  
  const subject = `New Reply on: ${itemTitle}`;
  const body = `
Hello,

Someone replied to a comment in SNT Data Assembly.

-------------------------------------------
REPLY DETAILS
-------------------------------------------

Item: ${itemTitle}
Reply by: ${replier || 'Unknown'}
${hasAttachment ? 'Includes attachment' : ''}

Reply:
"${replyText || 'No text'}"

-------------------------------------------

Please log in to SNT Data Assembly to view and respond.

Best regards,
${CONFIG.SENDER_NAME}
  `.trim();
  
  // Notify ALL platform users
  return notifyAllPlatformUsers(subject, body);
}

/**
 * Send new item added notification - TO ALL USERS
 */
function sendNewItemEmail(data) {
  // Handle direct execution without data
  if (!data) {
    console.log('sendNewItemEmail: No data provided. This function is called automatically when items are added.');
    return { success: false, message: 'No data provided - this function is called by the app, not directly' };
  }
  
  const { itemTitle, section, addedBy, description, hasAttachment } = data;
  
  const subject = `New Item Added: ${itemTitle}`;
  const body = `
Hello,

A new item has been added in SNT Data Assembly.

-------------------------------------------
ITEM DETAILS
-------------------------------------------

Title: ${itemTitle}
Section: ${section || 'Unknown'}
Added by: ${addedBy || 'Unknown'}
${hasAttachment ? 'Includes attachment' : ''}

Description:
${description || 'No description provided'}

-------------------------------------------

Please log in to SNT Data Assembly to view the details.

Best regards,
${CONFIG.SENDER_NAME}
  `.trim();
  
  // Notify ALL platform users
  return notifyAllPlatformUsers(subject, body);
}

/**
 * Create HTML email template
 */
function createEmailTemplate(subject, body, attachmentInfo) {
  const bodyHtml = (body || '').replace(/\n/g, '<br>');
  
  // Logo HTML - only show if SHOW_LOGO is true
  const logoHtml = CONFIG.SHOW_LOGO ? `
        <div style="display:inline-block;background:#ffffff;padding:10px;border-radius:12px;margin-bottom:15px;box-shadow:0 2px 8px rgba(0,0,0,0.2);">
          <img src="${CONFIG.LOGO_URL}" alt="ICF-SL Logo" style="max-width:100px;max-height:100px;width:auto;height:auto;display:block;object-fit:contain;">
        </div>
  ` : '';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <tr>
      <td style="background:#004080;padding:25px;text-align:center;">
        ${logoHtml}
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;">SNT Data Assembly</h1>
        <p style="margin:8px 0 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${CONFIG.ORG_NAME}</p>
      </td>
    </tr>
    
    <!-- Body -->
    <tr>
      <td style="padding:30px;">
        <h2 style="color:#004080;margin:0 0 20px 0;font-size:20px;">${subject}</h2>
        <div style="color:#333333;font-size:15px;line-height:1.6;">
          ${bodyHtml}
        </div>
        
        ${attachmentInfo ? `
        <div style="margin-top:20px;padding:15px;background:#f0f4f8;border-radius:8px;border-left:4px solid #004080;">
          <p style="margin:0;font-size:14px;color:#333;">
            <strong>Attachment:</strong> ${attachmentInfo}
          </p>
        </div>
        ` : ''}
        
        <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
          ${CONFIG.APP_URL ? `
          <a href="${CONFIG.APP_URL}" style="display:inline-block;padding:12px 24px;background:#004080;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">
            Open SNT Data Assembly
          </a>
          ` : `
          <p style="color:#666;font-size:14px;">Please open SNT Data Assembly to view details.</p>
          `}
        </div>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background:#004080;padding:20px;text-align:center;">
        <p style="margin:0;color:#ffffff;font-size:14px;font-weight:bold;">${CONFIG.ORG_NAME}</p>
        <p style="margin:8px 0 0 0;color:rgba(255,255,255,0.8);font-size:12px;">${CONFIG.ORG_TAGLINE}</p>
        <p style="margin:15px 0 0 0;color:rgba(255,255,255,0.6);font-size:11px;">
          This is an automated notification. Please do not reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ============================================
// BACKUP FUNCTIONS
// ============================================

/**
 * Sync data to Google Drive backup
 */
function syncData(data) {
  if (!CONFIG.ENABLE_BACKUP) {
    return { success: true, message: 'Backup disabled in config', skipped: true };
  }
  
  if (!data) {
    console.log('syncData: No data provided. This function is called automatically by the app.');
    return { success: false, message: 'No data provided' };
  }
  
  return backupData(data);
}

/**
 * Backup data to Google Drive
 */
function backupData(data) {
  try {
    // Use hardcoded defaults if CONFIG values are undefined
    const folderName = (CONFIG && CONFIG.BACKUP_FOLDER_NAME) ? CONFIG.BACKUP_FOLDER_NAME : 'SNT_Data_Assembly_Backup_v1';
    const fileName = (CONFIG && CONFIG.BACKUP_FILE_NAME) ? CONFIG.BACKUP_FILE_NAME : 'snt_data_backup_v1.json';
    
    const folder = getOrCreateFolder(folderName);
    const files = folder.getFilesByName(fileName);
    
    const backupContent = JSON.stringify({
      lastUpdated: new Date().toISOString(),
      itemCount: data ? (Array.isArray(data) ? data.length : Object.keys(data).length) : 0,
      version: '1.0',
      data: data
    }, null, 2);
    
    let fileId;
    if (files.hasNext()) {
      const file = files.next();
      file.setContent(backupContent);
      fileId = file.getId();
      log('Backup updated', { fileId: fileId });
    } else {
      const file = folder.createFile(fileName, backupContent, MimeType.PLAIN_TEXT);
      fileId = file.getId();
      log('Backup created', { fileId: fileId });
    }
    
    return { 
      success: true, 
      message: 'Backup saved successfully',
      fileId: fileId,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logError('backupData', error);
    return { success: false, message: 'Backup failed: ' + error.toString() };
  }
}

/**
 * Load backup data from Google Drive
 */
function loadBackupData() {
  try {
    // Use hardcoded defaults if CONFIG values are undefined
    const folderName = (CONFIG && CONFIG.BACKUP_FOLDER_NAME) ? CONFIG.BACKUP_FOLDER_NAME : 'SNT_Data_Assembly_Backup_v1';
    const fileName = (CONFIG && CONFIG.BACKUP_FILE_NAME) ? CONFIG.BACKUP_FILE_NAME : 'snt_data_backup_v1.json';
    
    const folders = DriveApp.getFoldersByName(folderName);
    
    if (!folders.hasNext()) {
      return null;
    }
    
    const folder = folders.next();
    const files = folder.getFilesByName(fileName);
    
    if (!files.hasNext()) {
      return null;
    }
    
    const file = files.next();
    const content = file.getBlob().getDataAsString();
    return JSON.parse(content);
    
  } catch (error) {
    logError('loadBackupData', error);
    return null;
  }
}

/**
 * Get or create a folder in Google Drive
 */
function getOrCreateFolder(folderName) {
  // ALWAYS use default if folder name is invalid
  const defaultName = 'SNT_Data_Assembly_Backup_v1';
  
  if (!folderName || typeof folderName !== 'string' || folderName.trim() === '') {
    console.log('Using default folder name: ' + defaultName);
    folderName = defaultName;
  } else {
    folderName = folderName.trim();
  }
  
  try {
    const folders = DriveApp.getFoldersByName(folderName);
    
    if (folders.hasNext()) {
      console.log('Folder found: ' + folderName);
      return folders.next();
    }
    
    console.log('Creating folder: ' + folderName);
    const folder = DriveApp.createFolder(folderName);
    console.log('Folder created successfully with ID: ' + folder.getId());
    return folder;
    
  } catch (error) {
    console.error('Error in getOrCreateFolder: ' + error.toString());
    // Last resort - try with default name
    try {
      const folders = DriveApp.getFoldersByName(defaultName);
      if (folders.hasNext()) {
        return folders.next();
      }
      return DriveApp.createFolder(defaultName);
    } catch (e) {
      console.error('Failed to create default folder: ' + e.toString());
      throw e;
    }
  }
}

// ============================================
// LOGGING FUNCTIONS
// ============================================

/**
 * Log info message
 */
function log(message, data) {
  if (CONFIG.ENABLE_LOGGING) {
    console.log(`[SNT] ${message}`, data ? JSON.stringify(data) : '');
  }
}

/**
 * Log error message
 */
function logError(source, error) {
  console.error(`[SNT ERROR] ${source}:`, error.toString());
  
  // Optionally send error notification to admin
  // Uncomment below to enable error emails
  /*
  try {
    GmailApp.sendEmail(
      CONFIG.ADMIN_EMAIL,
      '[SNT Data Assembly] Error Alert',
      `An error occurred in ${source}:\n\n${error.toString()}\n\nTimestamp: ${new Date().toISOString()}`
    );
  } catch (e) {
    console.error('Failed to send error notification:', e);
  }
  */
}

// ============================================
// TEST FUNCTIONS
// ============================================

/**
 * QUICK TEST - Run this first to verify script is working!
 * This function can be run directly from the editor.
 */
function quickTest() {
  console.log('=================================');
  console.log('SNT Data Assembly - Quick Test');
  console.log('=================================');
  console.log('');
  console.log('Script is running correctly!');
  console.log('');
  console.log('Configuration:');
  console.log('  - Admin Email: ' + (CONFIG ? CONFIG.ADMIN_EMAIL : 'CONFIG not defined'));
  console.log('  - Email Enabled: ' + (CONFIG ? CONFIG.ENABLE_EMAIL : 'CONFIG not defined'));
  console.log('  - Backup Enabled: ' + (CONFIG ? CONFIG.ENABLE_BACKUP : 'CONFIG not defined'));
  console.log('  - Backup Folder: ' + (CONFIG ? CONFIG.BACKUP_FOLDER_NAME : 'CONFIG not defined'));
  console.log('  - Backup File: ' + (CONFIG ? CONFIG.BACKUP_FILE_NAME : 'CONFIG not defined'));
  console.log('  - Platform Users: ' + (CONFIG ? CONFIG.PLATFORM_USERS.length : 'CONFIG not defined'));
  console.log('  - Logo in Emails: ' + (CONFIG && CONFIG.SHOW_LOGO ? 'Enabled' : 'Disabled'));
  console.log('  - App URL: ' + (CONFIG && CONFIG.APP_URL ? CONFIG.APP_URL : '(not set)'));
  console.log('');
  if (CONFIG && CONFIG.PLATFORM_USERS) {
    console.log('Platform Users:');
    CONFIG.PLATFORM_USERS.forEach((user, i) => {
      console.log('  ' + (i+1) + '. ' + user.name + ' (' + user.email + ') - ' + user.role);
    });
    console.log('');
  }
  console.log('=================================');
  console.log('Next Steps:');
  console.log('1. Run "testFolder" to test folder creation');
  console.log('2. Run "testEmailNotification" to test email');
  console.log('3. Deploy as Web App');
  console.log('=================================');
  
  return { success: true, message: 'Quick test passed!' };
}

/**
 * TEST FOLDER CREATION - Run this to verify folder creation works
 */
function testFolder() {
  console.log('=================================');
  console.log('Testing Folder Creation');
  console.log('=================================');
  
  try {
    const folderName = 'SNT_Data_Assembly_Backup_v1';
    console.log('Creating/finding folder: ' + folderName);
    
    const folder = getOrCreateFolder(folderName);
    
    console.log('SUCCESS! Folder ID: ' + folder.getId());
    console.log('Folder Name: ' + folder.getName());
    console.log('Folder URL: https://drive.google.com/drive/folders/' + folder.getId());
    console.log('');
    console.log('Now testing file creation...');
    
    // Test creating a file
    const testFileName = 'test_file.txt';
    const files = folder.getFilesByName(testFileName);
    
    if (files.hasNext()) {
      const file = files.next();
      file.setContent('Test at ' + new Date().toISOString());
      console.log('Test file updated: ' + file.getId());
    } else {
      const file = folder.createFile(testFileName, 'Test created at ' + new Date().toISOString(), MimeType.PLAIN_TEXT);
      console.log('Test file created: ' + file.getId());
    }
    
    console.log('');
    console.log('=================================');
    console.log('ALL TESTS PASSED!');
    console.log('=================================');
    
    return { success: true, folderId: folder.getId() };
    
  } catch (error) {
    console.error('ERROR: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Test email notification - Run this to verify email works
 */
function testEmailNotification() {
  const result = sendEmail(
    CONFIG.ADMIN_EMAIL,
    'Test Email from SNT Data Assembly',
    `Hello!

This is a test email to verify that your SNT Data Assembly email notifications are working correctly.

-------------------------------------------
TEST DETAILS
-------------------------------------------

Email service: Working
Recipient: ${CONFIG.ADMIN_EMAIL}
Timestamp: ${new Date().toLocaleString()}
Config Status:
   - Email enabled: ${CONFIG.ENABLE_EMAIL}
   - Backup enabled: ${CONFIG.ENABLE_BACKUP}
   - Platform users: ${CONFIG.PLATFORM_USERS.length}

-------------------------------------------

If you received this email, your setup is complete!

Best regards,
SNT Data Assembly System`
  );
  
  console.log('Test email result:', JSON.stringify(result));
  return result;
}

/**
 * Test backup functionality
 */
function testBackup() {
  const testData = [
    {
      id: 'test-1',
      title: 'Test Item',
      section: 'nextstep',
      date: new Date().toISOString(),
      description: 'This is a test backup item'
    }
  ];
  
  const result = backupData(testData);
  console.log('Test backup result:', JSON.stringify(result));
  return result;
}

/**
 * Test notifying all users
 */
function testNotifyAll() {
  const result = notifyAllUsers(
    'Test Broadcast from SNT Data Assembly',
    'This is a test broadcast message to all platform users.\n\nIf you received this, the notification system is working!',
    'System Test',
    null // Don't exclude anyone
  );
  
  console.log('Test notify all result:', JSON.stringify(result));
  return result;
}

/**
 * View current backup data
 */
function viewBackupData() {
  const data = loadBackupData();
  console.log('Current backup data:', JSON.stringify(data, null, 2));
  return data;
}

/**
 * List all platform users
 */
function listPlatformUsers() {
  console.log('Platform Users:');
  CONFIG.PLATFORM_USERS.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.role}`);
  });
  return CONFIG.PLATFORM_USERS;
}

// ============================================
// SCHEDULED FUNCTIONS (Optional)
// ============================================

/**
 * Daily backup check - Set up a time trigger for this
 * To set up: Edit > Current project's triggers > Add Trigger
 * Choose: dailyBackupCheck, Time-driven, Day timer, 9am-10am
 */
function dailyBackupCheck() {
  try {
    const data = loadBackupData();
    
    if (!data) {
      log('Daily check: No backup found');
      return;
    }
    
    const lastUpdate = new Date(data.lastUpdated);
    const hoursSinceBackup = (new Date() - lastUpdate) / (1000 * 60 * 60);
    
    log('Daily backup check', { 
      lastUpdated: data.lastUpdated, 
      hoursSinceBackup: hoursSinceBackup.toFixed(1),
      itemCount: data.itemCount 
    });
    
    // Alert if backup is more than 48 hours old
    if (hoursSinceBackup > 48) {
      sendEmail(
        CONFIG.ADMIN_EMAIL,
        'SNT Data Assembly - Backup Warning',
        `Warning: The SNT Data Assembly backup has not been updated in over 48 hours.

Last backup: ${data.lastUpdated}
Hours since backup: ${hoursSinceBackup.toFixed(1)}

This could mean:
1. No users have made changes recently (normal)
2. The app is not syncing properly (check the Script URL setting)
3. There's a connection issue

Please verify the system is working correctly.`
      );
    }
    
  } catch (error) {
    logError('dailyBackupCheck', error);
  }
}

/**
 * Create daily trigger for backup check
 * Run this once to set up automatic daily checks
 */
function setupDailyTrigger() {
  // Remove existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailyBackupCheck') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new daily trigger at 9 AM
  ScriptApp.newTrigger('dailyBackupCheck')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
    
  console.log('Daily trigger created for dailyBackupCheck at 9 AM');
}

/**
 * Remove all triggers
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  console.log(`Removed ${triggers.length} trigger(s)`);
}
