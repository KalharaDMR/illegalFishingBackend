// services/twilio.service.js
const twilio = require('twilio');
require('dotenv').config();

class TwilioSMSService {
    constructor() {
        // Validate Twilio credentials
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.error('❌ Twilio credentials missing in .env file');
            return;
        }

        // Initialize Twilio client
        this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
        
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
        this.isTrial = true; // You're on trial account
        
        console.log('✅ Twilio SMS service initialized (Trial Mode)');
        console.log(`📱 From number: ${this.fromNumber}`);
        console.log('⚠️  Trial account: Can only send to verified numbers');
    }

    /**
     * Send SMS alert about investigation completion
     * @param {Object} investigation - Investigation data
     * @param {Object} report - Original report data
     * @param {Object} officer - Officer who conducted investigation
     * @param {string} toNumber - Recipient phone number
     */
    async sendInvestigationAlert(investigation, report, officer, toNumber) {
        try {
            // Check if recipient is verified (for trial account)
            if (this.isTrial) {
                console.log(`🔍 Trial mode: Verifying if ${toNumber} is in your verified list...`);
                // The API will throw error if not verified - we catch it gracefully
            }

            // Format the SMS message
            const messageBody = this.formatInvestigationMessage(investigation, report, officer);

            // Send SMS via Twilio
            const result = await this.client.messages.create({
                body: messageBody,
                from: this.fromNumber,
                to: toNumber
            });

            console.log(`✅ SMS sent successfully! SID: ${result.sid}`);
            
            return {
                success: true,
                messageId: result.sid,
                status: result.status,
                to: toNumber,
                cost: result.price ? `${result.price} ${result.priceUnit}` : 'Trial - No charge',
                provider: 'Twilio'
            };

        } catch (error) {
            // Handle specific Twilio errors
            if (error.code === 21211) {
                console.error('❌ Invalid phone number format:', toNumber);
                return {
                    success: false,
                    error: 'Invalid phone number format',
                    code: error.code,
                    suggestion: 'Use format: +947XXXXXXXX'
                };
            }
            
            if (error.code === 21608) {
                console.error('❌ Trial account restriction - Number not verified:', toNumber);
                return {
                    success: false,
                    error: 'Number not verified in Twilio trial account',
                    code: error.code,
                    suggestion: 'Add this number to Verified Caller IDs in Twilio Console'
                };
            }

            console.error('❌ Twilio SMS error:', error.message);
            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    /**
     * Send bulk SMS to multiple admins
     * @param {Array} adminNumbers - Array of phone numbers
     * @param {Object} investigation - Investigation data
     * @param {Object} report - Report data
     * @param {Object} officer - Officer data
     */
    async sendBulkAlerts(adminNumbers, investigation, report, officer) {
        const results = [];
        
        for (const number of adminNumbers) {
            // Add small delay to avoid rate limits
            await this.delay(500);
            
            const result = await this.sendInvestigationAlert(
                investigation, 
                report, 
                officer, 
                number
            );
            
            results.push({
                number,
                ...result
            });
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        return {
            success: successful > 0,
            total: results.length,
            successful,
            failed,
            details: results,
            provider: 'Twilio'
        };
    }

    /**
     * Format investigation message (keep under 160 chars for single SMS)
     */
    formatInvestigationMessage(investigation, report, officer) {
        const actionEmoji = {
            'WARNING': '⚠️',
            'FINE': '💰',
            'EQUIPMENT_CONFISCATED': '⚓',
            'ARREST': '👮',
            'NO_ACTION': '✅',
            'OTHER': '📝'
        };

        const emoji = actionEmoji[investigation.actionTaken] || '📋';
        
        // Create concise message (SMS limit is 160 chars for single message)
        const message = 
`${emoji} INVESTIGATION COMPLETED
Report #: ${report._id.toString().slice(-6)}
District: ${report.district || 'Unknown'}
Action: ${investigation.actionTaken.replace(/_/g, ' ')}
Found Illegal: ${investigation.illegalActivityFound ? 'YES' : 'NO'}
${investigation.fineAmount ? `Fine: LKR ${investigation.fineAmount}` : ''}
Officer: ${officer.name || 'Unknown'}

Details: ${investigation.actionDescription || 'No details provided'}`;

        return message.substring(0, 1600); // Twilio handles long messages automatically
    }

    /**
     * Format detailed HTML version (for logging/email)
     */
    formatDetailedMessage(investigation, report, officer) {
        return {
            sms: this.formatInvestigationMessage(investigation, report, officer),
            details: {
                reportId: report._id,
                reportDate: report.createdAt,
                location: report.location,
                district: report.district,
                officerName: officer.name,
                officerContact: officer.phone,
                visited: investigation.visited ? 'Yes' : 'No',
                actualSituation: investigation.actualSituation,
                illegalFound: investigation.illegalActivityFound ? 'Yes' : 'No',
                actionTaken: investigation.actionTaken,
                actionDescription: investigation.actionDescription,
                fineAmount: investigation.fineAmount,
                visitDate: investigation.visitDate,
                officerNotes: investigation.officerNotes,
                evidenceCount: {
                    images: investigation.evidenceImages?.length || 0,
                    videos: investigation.evidenceVideos?.length || 0
                }
            }
        };
    }

    /**
     * Check account balance/info
     */
    async checkAccountInfo() {
        try {
            const account = await this.client.api.accounts(
                process.env.TWILIO_ACCOUNT_SID
            ).fetch();

            return {
                success: true,
                friendlyName: account.friendlyName,
                status: account.status,
                type: account.type,
                isTrial: account.type === 'Trial',
                dateCreated: account.dateCreated
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get verified numbers (for trial account)
     */
    async getVerifiedNumbers() {
        try {
            const outgoingCallerIds = await this.client.outgoingCallerIds.list();
            
            return {
                success: true,
                verified: outgoingCallerIds.map(id => ({
                    number: id.phoneNumber,
                    friendlyName: id.friendlyName
                }))
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = TwilioSMSService;