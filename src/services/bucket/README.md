# Полезные ссылки для изучения апи

- [Полезная статья о загрузке файлов](https://stacktuts.com/how-to-upload-an-in-memory-file-data-to-google-cloud-storage-using-nodejs)
- [Основная дока](https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
- [Доп статья](https://dev.to/kamalhossain/upload-file-to-google-cloud-storage-from-nodejs-server-5cdg)

## Прицнип добавления/работы
Нужно, как и с firestore module, добавлять бакет модули, по примеру customization-logo. Модуль уже умеет создавать его и устанавливать правила работы с бакетом.
Бакет - по сути фолдер. Будем делить наши лого на отдельный бакет, а, например ,чеки, на бакет receipt-data или вроде того. И так с каждым будущем хранилищем данных.

В базе данных, обязательное условие, хранить лишь относительные пути до наших файлов, причем будем добавлять префикс api/file/.

В приложении NEXT, будет существовать page/api/file, который будет заниматься проксированием до относительного пути, добавленного после значения file.