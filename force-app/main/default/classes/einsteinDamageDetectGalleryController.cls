public with sharing class einsteinDamageDetectGalleryController {
    @AuraEnabled(cacheable=true)
    public static List<damage__c> getDamages(Id carId) {
        return [
            SELECT Id, description__c, evaluation__c, part__c, picture__c
            FROM damage__c
            WHERE car__c = :carId
        ];
    }
}