// services/notification.service.js

const TwilioSMSService = require('./twilio.service');
require('dotenv').config();

class NotificationService {
    constructor() {
        this.smsService = new TwilioSMSService();
        
        // Parse admin numbers from .env
        this.adminNumbers = process.env.ADMIN_PHONE_NUMBERS 
            ? process.env.ADMIN_PHONE_NUMBERS.split(',').map(n => n.trim())
            : process.env.ADMIN_PHONE_NUMBER 
                ? [process.env.ADMIN_PHONE_NUMBER]
                : [];
        
        console.log(`📱 Notification service initialized with ${this.adminNumbers.length} admin numbers`);
    }

    /**
     * Send notification for investigation completed
     * @param {Object} investigation - Investigation document
     * @param {Object} report - Original report document
     * @param {Object} officer - Officer document
     */
    async sendInvestigationCompletedNotification(investigation, report, officer) {
        const results = {
            sms: null,
            timestamp: new Date().toISOString(),
            investigationId: investigation._id
        };

        // Send SMS if admin numbers are configured
        if (this.adminNumbers.length > 0) {
            console.log(`📱 Sending SMS alerts to ${this.adminNumbers.length} admins...`);
            
            // Determine which admins get alerts based on action
            let recipients = this.adminNumbers;
            
            // For HIGH severity actions, notify all admins
            if (['ARREST', 'EQUIPMENT_CONFISCATED'].includes(investigation.actionTaken)) {
                recipients = this.adminNumbers; // All admins
            } 
            // For FINE, notify primary admins (first 2)
            else if (investigation.actionTaken === 'FINE' && investigation.fineAmount > 10000) {
                recipients = this.adminNumbers.slice(0, 2);
            }
            // For others, just primary admin
            else {
                recipients = [this.adminNumbers[0]];
            }

            // Send SMS alerts
            results.sms = await this.smsService.sendBulkAlerts(
                recipients,
                investigation,
                report,
                officer
            );

            // Log results
            if (results.sms.success) {
                console.log(`✅ SMS alerts sent successfully to ${results.sms.successful} admins`);
            } else {
                console.warn('⚠️ SMS alerts had issues:', results.sms.error);
            }
        } else {
            console.warn('⚠️ No admin phone numbers configured for SMS alerts');
            results.sms = {
                success: false,
                error: 'No admin phone numbers configured',
                suggestion: 'Add ADMIN_PHONE_NUMBERS to .env file'
            };
        }

        return results;
    }

    /**
     * Generic notification sender (for future use)
     */
    async sendNotification(notificationData) {
        const { type, data } = notificationData;
        
        switch(type) {
            case 'INVESTIGATION_COMPLETED':
                return this.sendInvestigationCompletedNotification(
                    data.investigation,
                    data.report,
                    data.officer
                );
            
            case 'NEW_REPORT_SUBMITTED':
                // Future implementation
                return this.sendNewReportNotification(data.report);
            
            case 'URGENT_ALERT':
                // Future implementation
                return this.sendUrgentAlert(data);
            
            default:
                console.warn(`Unknown notification type: ${type}`);
                return { success: false, error: 'Unknown notification type' };
        }
    }
}

module.exports = new NotificationService();