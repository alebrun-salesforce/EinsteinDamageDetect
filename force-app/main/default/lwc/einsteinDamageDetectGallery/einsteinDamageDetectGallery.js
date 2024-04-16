import { LightningElement, api, wire } from 'lwc';
import getDamages from '@salesforce/apex/einsteinDamageDetectGalleryController.getDamages';

export default class EinsteinDamageDetectGallery extends LightningElement {
    @api recordId;

    @api labelDescription
    @api labelEvaluation;
    @api labelPart;
    
    @api partDamageVeryImportant;
    @api partDamageImportant;
    @api partDamageNormal;
    @api partDamageSmall;
    @api partDamageVerySmall;

    @wire(getDamages, { carId: '$recordId' })
    damages;

    get damagesWithEvaluation() {
        if (this.damages.data) {
            return this.damages.data.map(damage => {
                const evaluationText = this.getEvaluationText(damage.evaluation__c);
                console.log(`Damage ID: ${damage.Id}, Evaluation: ${damage.evaluation__c}, Evaluation Text: ${evaluationText}`);
                return {
                    ...damage,
                    evaluationText: evaluationText
                };
            });
        }
        return [];
    }

    getEvaluationText(score) {
        if (score === undefined || score === null) {
            console.log('Score is undefined or null');
            return 'N/A';
        }

        console.log(`Score: ${score}`);

        if (score >= 90) {
            return this.partDamageVeryImportant;
        } else if (score >= 70) {
            return this.partDamageImportant;
        } else if (score >= 50) {
            return this.partDamageNormal;
        } else if (score >= 30) {
            return this.partDamageSmall;
        } else {
            return this.partDamageVerySmall;
        }
    }
}