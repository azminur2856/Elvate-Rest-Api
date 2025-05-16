import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
interface FacePlusPlusResponse {
  confidence: number;
}
@Injectable()
export class FaceVerificationService {
  private readonly API_KEY = process.env.FACEPP_API_KEY;
  private readonly API_SECRET = process.env.FACEPP_API_SECRET;

  async compareFaces(
    base64Image1: string,
    base64Image2: string,
  ): Promise<boolean> {
    try {
      const url = 'https://api-us.faceplusplus.com/facepp/v3/compare';

      const form = new URLSearchParams();
      if (!this.API_KEY || !this.API_SECRET) {
        throw new NotFoundException('API credentials are not set');
      }
      form.append('api_key', this.API_KEY);
      form.append('api_secret', this.API_SECRET);
      form.append('image_base64_1', base64Image1);
      form.append('image_base64_2', base64Image2);

      const response = await axios.post(url, form.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      console.log('pass');

      if (response.status !== 200) {
        console.log('Face++ API error:', response.data); // Debug
      }
      console.log('Face++ response:', response.data); // Debug

      const similarity = (response.data as FacePlusPlusResponse).confidence;
      console.log('Similarity:', similarity); // Debug
      return similarity >= 75;
    } catch (err) {
      console.error(err.response?.data || err.message);
      throw new InternalServerErrorException('Face++ API request failed');
    }
  }

  async compareFacesForLogin(
    base64Image1: string,
    base64Image2: string,
  ): Promise<boolean> {
    if (!this.API_KEY || !this.API_SECRET) {
      throw new NotFoundException('Face++ API keys not set');
    }

    const form = new URLSearchParams();
    form.append('api_key', this.API_KEY);
    form.append('api_secret', this.API_SECRET);
    form.append('image_base64_1', base64Image1);
    form.append('image_base64_2', base64Image2);

    try {
      const response = await axios.post(
        'https://api-us.faceplusplus.com/facepp/v3/compare',
        form.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      const similarity = (response.data as FacePlusPlusResponse).confidence;

      return similarity >= 75;
    } catch (err) {
      console.error(err.response?.data || err.message);
      throw new InternalServerErrorException('Face++ API failed');
    }
  }
}
