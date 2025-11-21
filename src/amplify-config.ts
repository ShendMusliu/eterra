import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

console.log('Amplify Outputs:', outputs);

try {
    Amplify.configure(outputs);
    console.log('Amplify configured successfully');
} catch (error) {
    console.error('Error configuring Amplify:', error);
}
