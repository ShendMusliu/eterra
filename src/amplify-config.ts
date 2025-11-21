import { Amplify } from 'aws-amplify';
import localOutputs from '../amplify_outputs.json';

// Prefer runtime outputs baked into the deployed app (public/amplify_outputs.json from pipeline),
// falling back to the repo copy for local dev. Export a promise we can await before rendering.
export const amplifyReady = (async () => {
  let outputs = localOutputs;
  try {
    const response = await fetch('/amplify_outputs.json', { cache: 'no-store' });
    if (response.ok) {
      outputs = await response.json();
    } else {
      console.warn('Using local amplify_outputs.json because fetch failed with status', response.status);
    }
  } catch (error) {
    console.warn('Using local amplify_outputs.json because fetch failed', error);
  }

  console.log('Amplify Outputs:', outputs);
  try {
    Amplify.configure(outputs);
    console.log('Amplify configured successfully');
  } catch (error) {
    console.error('Error configuring Amplify:', error);
  }
})();
