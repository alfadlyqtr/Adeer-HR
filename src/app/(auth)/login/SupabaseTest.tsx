"use client";
import { useState } from 'react';
import { supabase, resetSupabaseClient } from '@/lib/supabaseClient';

export default function SupabaseTest() {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  // Add a log message with timestamp
  const log = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runConnectionTest = async () => {
    setLoading(true);
    setResults([]);
    
    try {
      // Get environment variables
      const supabaseUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = key || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      // Log what we're using
      log(`Testing connection to: ${supabaseUrl}`);
      log(`Using key: ${supabaseKey ? supabaseKey.substring(0, 5) + '...' : 'Not set'}`);
      
      // Try basic fetch to the URL
      try {
        log('Attempting basic URL fetch...');
        const response = await fetch(supabaseUrl, {
          method: 'HEAD',
          mode: 'no-cors',
        });
        log(`URL access: Completed request (note: with no-cors mode, we can't see the actual status)`);
      } catch (err: any) {
        log(`URL access failed: ${err.message}`);
      }
      
      // Try proxy API endpoint
      try {
        log('Attempting auth via proxy API...');
        const proxyResponse = await fetch('/api/auth-proxy?url=' + encodeURIComponent(supabaseUrl) + '&key=' + encodeURIComponent(supabaseKey));
        const proxyData = await proxyResponse.json();
        
        if (proxyResponse.ok) {
          log(`✅ Proxy connection successful: ${proxyData.message || 'Connection OK'}`);
        } else {
          log(`❌ Proxy connection failed: ${proxyData.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        log(`❌ Proxy API access failed: ${err.message}`);
      }
      
      // Try direct auth endpoint (likely to fail with CORS)
      try {
        log('Attempting direct auth endpoint access (may fail with CORS)...');
        const authUrl = `${supabaseUrl}/auth/v1/`;
        const response = await fetch(authUrl, {
          method: 'HEAD',
          headers: {
            'apikey': supabaseKey
          }
        });
        log(`✅ Direct auth endpoint access: ${response.status} ${response.statusText}`);
      } catch (err: any) {
        log(`❌ Direct auth endpoint access failed: ${err.message}`);
      }
      
      // Try to manually create the connection using our resetSupabaseClient function
      try {
        log('Attempting to create test client with provided credentials...');
        
        if (supabaseUrl && supabaseKey) {
          // Save the credentials to localStorage and reset the client
          log('Using resetSupabaseClient with provided credentials...');
          const testClient = resetSupabaseClient(supabaseUrl, supabaseKey);
          log('Client initialized successfully');
          
          log('Testing authentication service...');
          const { data, error } = await testClient.auth.getSession();
          
          if (error) {
            log(`❌ Auth test error: ${error.message}`);
          } else {
            log(`✅ Auth test succeeded: ${data.session ? 'Active session found' : 'No active session'}`);
            // Save the working values for later use
            if (typeof window !== 'undefined') {
              localStorage.setItem('supabase_test_url', supabaseUrl);
              localStorage.setItem('supabase_test_key', supabaseKey);
              log('✅ Credentials saved to localStorage for future use');
            }
          }
        } else {
          log('❌ Cannot create test client: URL or key missing');
        }
      } catch (err: any) {
        log(`❌ Supabase client test failed: ${err.message}`);
      }
      
      log('--- Test completed ---');
      
    } catch (error: any) {
      log(`Test failed with error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="mt-4 rounded-lg border p-4 bg-gray-50 dark:bg-gray-900">
      <h2 className="text-lg font-medium mb-2">Supabase Connection Test</h2>
      
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-sm mb-1">Supabase URL (optional override)</label>
          <input 
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-project-id.supabase.co"
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm mb-1">Anon Key (optional override)</label>
          <input 
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="your-anon-key"
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
      </div>
      
      <button
        onClick={runConnectionTest}
        disabled={loading}
        className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Running Tests...' : 'Test Supabase Connection'}
      </button>
      
      {results.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Test Results:</h3>
          <div className="bg-black rounded p-2 max-h-60 overflow-y-auto">
            {results.map((result, index) => (
              <div key={index} className="text-xs font-mono mb-1">
                <span className="text-green-400">&gt;</span> <span className="text-white">{result}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
