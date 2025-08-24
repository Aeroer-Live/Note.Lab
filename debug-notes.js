// Debug script to test Note.Lab API and identify sync issues
// Run this in the browser console on your deployed site

class NoteLabDebugger {
    constructor() {
        this.apiBase = 'https://note-lab.aeroermark.workers.dev/api';
        this.token = localStorage.getItem('notelab_token');
        this.user = JSON.parse(localStorage.getItem('notelab_user') || '{}');
    }

    async testAuthentication() {
        console.log('🔍 Testing Authentication...');
        console.log('Token:', this.token ? 'Present' : 'Missing');
        console.log('User:', this.user);
        
        if (!this.token) {
            console.error('❌ No authentication token found');
            return false;
        }

        try {
            const response = await fetch(`${this.apiBase}/user/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            console.log('Profile Response:', data);
            
            if (response.ok) {
                console.log('✅ Authentication successful');
                return true;
            } else {
                console.error('❌ Authentication failed:', data);
                return false;
            }
        } catch (error) {
            console.error('❌ Authentication error:', error);
            return false;
        }
    }

    async testNotesAPI() {
        console.log('🔍 Testing Notes API...');
        
        if (!this.token) {
            console.error('❌ No token available for API test');
            return;
        }

        try {
            // Test getting notes
            const getResponse = await fetch(`${this.apiBase}/notes`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const getData = await getResponse.json();
            console.log('Get Notes Response:', getData);
            console.log('Notes count:', getData.data?.notes?.length || 0);

            // Test creating a note
            const testNote = {
                title: 'Debug Test Note',
                content: 'This is a test note created by the debugger',
                type: 'standard',
                starred: false,
                tags: ['debug', 'test'],
                metadata: { debug: true }
            };

            const createResponse = await fetch(`${this.apiBase}/notes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testNote)
            });

            const createData = await createResponse.json();
            console.log('Create Note Response:', createData);

            if (createResponse.ok) {
                console.log('✅ Test note created successfully');
                
                // Test getting notes again to see if the new note appears
                const getResponse2 = await fetch(`${this.apiBase}/notes`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const getData2 = await getResponse2.json();
                console.log('Get Notes After Create:', getData2);
                console.log('Notes count after create:', getData2.data?.notes?.length || 0);
            } else {
                console.error('❌ Failed to create test note:', createData);
            }

        } catch (error) {
            console.error('❌ Notes API error:', error);
        }
    }

    async testDatabaseConnection() {
        console.log('🔍 Testing Database Connection...');
        
        try {
            const response = await fetch(`${this.apiBase}/health`);
            const data = await response.json();
            console.log('Health Check Response:', data);
            
            if (response.ok) {
                console.log('✅ Database connection appears healthy');
            } else {
                console.error('❌ Database health check failed');
            }
        } catch (error) {
            console.error('❌ Database connection error:', error);
        }
    }

    checkLocalStorage() {
        console.log('🔍 Checking Local Storage...');
        
        const keys = ['notelab_token', 'notelab_user', 'notelab_session', 'notelab_notes'];
        
        keys.forEach(key => {
            const value = localStorage.getItem(key);
            console.log(`${key}:`, value ? 'Present' : 'Missing');
            if (value && key === 'notelab_user') {
                try {
                    console.log('User data:', JSON.parse(value));
                } catch (e) {
                    console.log('User data: Invalid JSON');
                }
            }
        });
    }

    async runFullDiagnostic() {
        console.log('🚀 Starting Note.Lab Diagnostic...');
        console.log('=====================================');
        
        this.checkLocalStorage();
        console.log('---');
        
        await this.testDatabaseConnection();
        console.log('---');
        
        const authOk = await this.testAuthentication();
        console.log('---');
        
        if (authOk) {
            await this.testNotesAPI();
        }
        
        console.log('=====================================');
        console.log('🏁 Diagnostic Complete');
    }
}

// Create global debugger instance
window.noteLabDebugger = new NoteLabDebugger();

// Auto-run diagnostic when script is loaded
window.noteLabDebugger.runFullDiagnostic();

console.log('💡 Usage:');
console.log('  - Run full diagnostic: noteLabDebugger.runFullDiagnostic()');
console.log('  - Test auth only: noteLabDebugger.testAuthentication()');
console.log('  - Test notes API: noteLabDebugger.testNotesAPI()');
console.log('  - Check localStorage: noteLabDebugger.checkLocalStorage()');
