
// Don't forget to add https://api.openai.com to the trusted URL and CORS
import { LightningElement, track, api } from 'lwc';
import { createRecord } from 'lightning/uiRecordApi';

export default class einsteinDamageDetect extends LightningElement {
    @track uploadedImages = [];
    @track analysisResults = [];
    @track isAnalyzing = false;
    @track maxTokens = 2000;
    @track isCreatingRecords = false;

    // Parameters with default values
    @api promptLanguage = 'English'; // Can be 'English' or 'Français'
    @api apiKey; // Must be set by the user
    @api title = 'Einstein Damage Detect'; // Default title of the card
    @api resultTitle = 'Analysis Results'; // Default title for results
    @api btnLabelAnalyse;
    @api labelFirstLoadingMessage;
    @api labelSecondLoadingMessage;

    // Expected AI Response
    promptJSON = `{
        'model':'',
        'brand':'',
        'color':'',
        'condition':'',
        'immatriculation':'',
        'summary':'',
        'damages':[
            {
                'part':'',
                'description':'',
                'evaluation':''
            }
        ]
    }`;


   // Handler for file input change
   handleFileChange(event) {
    const files = Array.from(event.target.files);
    this.uploadedImages = files.map(file => {
        const url = URL.createObjectURL(file);
        return { url, file };
    });
}

  // Convert file to base64 without the data URL prefix
  convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.replace(/^data:.+;base64,/, '');
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}
    

    // Trigger analysis on uploaded images
    async analyzeImages() {
        this.isAnalyzing = true;
        console.log('Converting images to base64...');
        
        const base64Images = await Promise.all(
            this.uploadedImages.map(image => this.convertFileToBase64(image.file))
        );
        
        console.log('Base64 conversion complete. Preparing API request...');
        
        console.log("language");
        console.log(this.promptLanguage);
    
        var prompt = this.englishPrompt;
        if(this.promptLanguage != 'English')
            prompt = this.frenchPrompt;

            console.log(prompt);

        const payload = {
            model: 'gpt-4-turbo',
            messages: [{
                role: 'user',
                content: [{
                    type: 'text',
                    text: prompt
                }, ...base64Images.map(base64 => ({
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${base64}`
                    }
                }))]
            }],
            max_tokens: 300
        };
        
        console.log('Final API Request Payload:', JSON.stringify(payload, null, 2));
        
        try {
            // Send the API request
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.apiKey
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorResponse = await response.json();
                console.error('API Error Response:', errorResponse);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            console.log('API response received. Processing data...');
            const data = await response.json();
            
            if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                console.log('Parsing analysis results');
                try {
                    this.isAnalyzing = false;
                    this.isCreatingRecords = true;
                    
                    const promises = data.choices.map(async (choice) => {
                        const carInfo = JSON.parse(choice.message.content);
                        await this.createCarAndDamages(carInfo, base64Images);
                        return {
                            id: choice.message.id,
                            formattedResult: JSON.stringify(carInfo, null, 2)
                        };
                    });
                    
                    this.analysisResults = await Promise.all(promises);
                    this.isCreatingRecords = false;
                } catch (e) {
                    console.error('Error parsing API response:', e);
                    this.showToast('Erreur', "Please retry to process your photo", 'error');
                    this.resetLoadingState();
                    return;


                }
            } else {
                console.error('Unexpected response from OpenAI API:', data);
                this.showToast('Erreur', "Please retry to process your photo", 'error');
                this.resetLoadingState();
                return;
            
            }
            
            console.log('Analysis results:', this.analysisResults);
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            alert('An error occurred while analyzing the images. Please check the console for more details.');
        } finally {
            this.isAnalyzing = false;
            console.log('Analysis process complete.');
        }
    }

    get hasAnalysisResults() {
        return this.analysisResults.length > 0;
    }

    async createCarAndDamages(carData, base64Images) {
        try {
            const fieldsCar = {
                'color__c': carData.color,
                'condition__c': carData.condition.toString(),
                'brand__c': carData.brand,
                'model__c': carData.model,
                'immatriculation__c': carData.immatriculation,
                'summary__c': carData.summary
            };
            
            const carRecord = { apiName: 'Car__c', fields: fieldsCar };
    
            const car = await createRecord(carRecord);
            console.log('Car record created:', car.id);
    
            for (let i = 0; i < carData.damages.length; i++) {
                const dmg = carData.damages[i];
                const base64Image = base64Images[i] || '';
    
                try {
                    const resizedDataUrl = await this.resizeImage(base64Image);
                    const fieldsDamage = {
                        'description__c': dmg.description,
                        'evaluation__c': dmg.evaluation.toString(),
                        'part__c': dmg.part,
                        'Car__c': car.id,
                        'picture__c': resizedDataUrl
                    };
                    const damageRecord = { apiName: 'damage__c', fields: fieldsDamage };
    
                    const damage = await createRecord(damageRecord);
                    console.log('Damage record created:', damage.id);
                } catch (error) {
                    console.error(`Error creating Damage record for damage ${i}:`, error);
                }
            }
        } catch (error) {
            console.error('Error creating Car record:', error);
            throw error;
        }
    }
    
    async resizeImage(base64String) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
    
                const maxSize = 300;
                let width = img.width;
                let height = img.height;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height *= maxSize / width;
                        width = maxSize;
                    } else {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }
    
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
    
                const resizedDataUrl = canvas.toDataURL('image/jpeg');
                resolve(resizedDataUrl);
            };
            img.onerror = (error) => reject(error);
            img.src = `data:image/jpeg;base64,${base64String}`;
        });
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
          title: title,
          message: message,
          variant: variant
        });
        this.dispatchEvent(event);
      }
      
      resetLoadingState() {
        this.isAnalyzing = false;
        this.isCreatingRecords = false;
        this.analysisResults = [];
      }


    /// PROMPTS ///
    englishPrompt = `You are a specialized AI in vehicle analysis. You only communicate with the JSON format that I provide.
    You receive a list of photos of a vehicle and you respond by analyzing the vehicle and its damages.
    
    Analyze each photo and provide the information in the following format:
    ${this.promptJSON}

    Model: The model of the car
    Brand: The brand of the car
    Color: The color of the car
    Condition: A precise rating from 0 to 100 of the condition of the vehicle in the photo (0 = horrible; 100 = perfect condition)
    Immatriculation: The immatriculation if it is visible on the provided photos
    Summary: A summary of the vehicle's condition in up to 1000 words
    Damages: A list of damages identified on the car
        With part, the part of the car shown in the photo, otherwise
        With description that describes the damage
        With evaluation that is a precise rating from 0 to 100 on the damage (0 = very minor damage; 50 = moderate damage; 100 = very significant damage)
    
    Go ahead and analyze the vehicle images and respond only in the JSON format without line breaks, starting with { and ending with }
    `;


    frenchPrompt = `Tu es une IA spécialisée dans l'analyse de véhicule. Tu ne communique uniquement avec le format JSON que je te donne.
    Tu reçois une liste de photo d'un véhicule et tu réponds en m'analysant le véhicule et ses dégats.

    Analyse chaque photo et donne les informations en Français au format suivant:
    ${this.promptJSON}

    Modèle (model): Le modèle du véhicule
    Marque (brand): La marque du véhicule
    Couleur (color): La couleur du véhicule
    Etat (etat): Une note précise de 0 à 100 de l'état du véhicule sur la photo (0 = horrible; 100=parfait état)
    Immatriculation (immatriculation): L'immatriculation du véhicule
    Résumé (resume): Un résumé de l'état du véhicule en 1000 mots maximum
    Degats (damage): Une liste des dégats identifiés sur la véhicule
        Avec partie (part), la partie de la véhicule sur la photo, sinon
        Avec description (description) qui décrit le dégat
        Avec évaluation (evaluation) qui est une note précise de 0 à 100 sur le dégat (0 = dégat très faible; 50 = dégat moyen; 100=dégat très important)

    Vas-y analyse les images du véhicule et réponds uniquement avec le format JSON sans retour à la ligne et en démarrant par { et en terminant par }
   `;


}