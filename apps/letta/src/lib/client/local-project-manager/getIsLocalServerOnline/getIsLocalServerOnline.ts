import axios from 'axios';
import { LOCAL_PROJECT_SERVER_URL } from '$letta/constants';

export async function getIsLocalServiceOnline() {
  try {
    return !!(await axios.get(`${LOCAL_PROJECT_SERVER_URL}/v1/health`));
  } catch (_e) {
    return false;
  }
}
