var csvParse = require('csv-parse');
const fs = require('fs');
const _ = require('lodash');
const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

// Processing csv file and generate json file
let dataFromCsvFile = [];
fs.createReadStream('input.csv')
.pipe(csvParse({
    columns:true,
    columns_duplicates_to_array: true
}))
.on('data', (row) => dataFromCsvFile.push(row))
.on('end', () => {
    transformAddresses(dataFromCsvFile)
    transformBooleansField(dataFromCsvFile)
    transformGroups(dataFromCsvFile)
    groupByEid(dataFromCsvFile)
    dataFromCsvFile = removeDuplicated(dataFromCsvFile)    
    saveJsonFile(dataFromCsvFile)
})

// transform phone and email address
function transformAddresses(dataFromCsvFile){
    return dataFromCsvFile.map((student)=>{        
        let addresses = []
        for (const [typeAndTags, address] of Object.entries(student)) {
            let splittedTypeAndTags = typeAndTags.split(" ");
            if (splittedTypeAndTags.length > 1) {
                delete student[typeAndTags];
            }
            const addressType = splittedTypeAndTags.shift()
            if ( addressType == 'phone' ){
                const phoneNumber = parsePhoneNumber(address)
                if (phoneNumber !== undefined) {
                    const createdPhoneAddress = createAddress(addressType, splittedTypeAndTags, phoneNumber)
                    addresses.push(createdPhoneAddress)
                }
            }
            if(addressType == 'email'){
                emails = address.split(/\/.|\s+/)
                for (const email of emails){
                    if (validateEmail(email)) {
                        const createdEmailAddress = createAddress(addressType, splittedTypeAndTags, email)
                        if (createdEmailAddress != undefined) {
                            addresses.push(createdEmailAddress)
                        }
                    } 
                    
                }
            }

        }
        if (addresses.length > 0) {            
            student.addresses = addresses
        }
        return student
    })
}

function parsePhoneNumber(phoneNumber){
    try {        
        const number = phoneUtil.parse(phoneNumber, 'BR');        
        const isValidNumber = phoneUtil.isValidNumber(number);
        if (isValidNumber) {
            let formatedPhoneNumber = phoneUtil.format(number, PNF.E164);
            return formatedPhoneNumber.slice(1)
        }
    } catch (error) {}
}
function validateEmail(email){
    const regex = /\S+@\S+\.\S+/;
    return regex.test(email);
}
function createAddress(addressType, tags, address) {
    return {
        type: addressType,
        tags:  tags,
        address: address
      }
}

// transform booleans fields
function transformBooleansField(dataFromCsvFile){
    return dataFromCsvFile.map((student=> {
        student.invisible = convertStringToBoolean(student.invisible)
        student.see_all = convertStringToBoolean(student.see_all)
        return student;
    }))
}
function convertStringToBoolean(field){
    const regexForFalse = /^\s*$|no|0/;    
    if(regexForFalse.test(field)){
        return false
    }
    const regexForTrue = /1|yes/;
    if(regexForTrue.test(field)){
        return true
    }
}

// transform groups
function transformGroups(dataFromCsvFile){
    return dataFromCsvFile.map((student=> {
        if (student.group.length > 0) {                        
            student.group = student.group.map((g)=>{            
                return _.split(g, /\/.|\,/).map(s => s.trim());
            })
            student.group = student.group.filter(g => {
                    return g != null && g != '';
                    });
            student.group = _.flattenDeep(student.group)        
            return student;
                    
        }
    }))
}

// group by eid
function groupByEid(dataFromCsvFile){
    return _.chain(dataFromCsvFile)
    .groupBy('eid')
    .map((student, eid) => {  
        if (student.length > 1) {
            student[0].group =  _.uniq(student[0].group.concat(...student[1].group))
            student[0].addresses =  _.uniq(student[0].addresses.concat(...student[1].addresses))
        } 
        return student
    })
    .value();
}

// remove duplicated objects
function removeDuplicated(dataFromCsvFile){
    return _.uniqBy(dataFromCsvFile, 'eid');
}

// save json file
function saveJsonFile(dataFromCsvFile){
    const json = JSON.stringify(dataFromCsvFile, null, 4)
    fs.writeFile(`output.json`, json, () => {})
}


